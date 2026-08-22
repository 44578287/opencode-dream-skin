import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { probeConnection, pullBundle } from "@/lib/remote/client";
import { mergeBundles } from "@/lib/remote/merge";
import { startLive, type LiveHandle } from "@/lib/remote/live";
import { resetDemoBus } from "@/lib/remote/demo-bus";

export async function runSync(direction: "pull" | "boot") {
  const state = useApp.getState();
  if (state.connection.kind === "offline") return;
  state.setSyncing(true);
  try {
    const health = await probeConnection(state.connection);
    state.setHost(health);
    if (!health.ok) {
      state.markSynced(health.error ?? "未连接");
      return;
    }
    if (direction === "boot" || direction === "pull") {
      const remote = await pullBundle(state.connection).catch(() => null);
      if (remote) {
        const merged = mergeBundles(state.snapshot(), remote, state.syncFlags);
        useApp.getState().applyBundle(merged.bundle);
      }
    }
    state.markSynced(`事件流已接通 · ${health.label}`);
  } catch (err) {
    state.setHost({
      ok: false,
      kind: state.connection.kind,
      version: "",
      label: state.connection.kind === "demo" ? "演示主机" : state.connection.url,
      error: err instanceof Error ? err.message : "同步失败",
    });
    state.markSynced(err instanceof Error ? err.message : "同步失败");
  }
}

export function RemoteBridge() {
  const connection = useApp((s) => s.connection);
  const handle = useRef<LiveHandle | null>(null);

  useEffect(() => {
    handle.current?.stop();
    handle.current = null;
    if (connection.kind === "offline") {
      useApp.getState().setLive({ connected: false, lastEventType: null });
      return;
    }
    void runSync("boot").then(() => {
      handle.current = startLive(connection);
    });
    return () => {
      handle.current?.stop();
      handle.current = null;
      if (connection.kind === "demo") resetDemoBus();
    };
  }, [connection.kind, connection.url, connection.username, connection.password]);

  return null;
}
