import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import {
  createRemoteSession,
  fetchDefaultModel,
  fetchProject,
  fetchProviders,
  fileStatus,
  listFileNodes,
  listRemoteMessages,
  listRemoteSessions,
  probeConnection,
  readRemoteFile,
} from "@/lib/remote/client";
import { startLive, type LiveHandle } from "@/lib/remote/live";
import { isNativeShell, type Connection, type FileNode } from "@/lib/remote/types";

async function collectFiles(conn: Connection, path: string, depth: number): Promise<FileNode[]> {
  if (depth > 4) return [];
  const nodes = await listFileNodes(conn, path).catch(() => []);
  const out: FileNode[] = [];
  for (const node of nodes) {
    if (node.ignored || node.name === ".git" || node.name === "node_modules") continue;
    if (node.type === "directory") {
      out.push(...(await collectFiles(conn, node.path || node.name, depth + 1)));
    } else {
      out.push(node);
    }
  }
  return out.slice(0, 120);
}

export async function loadWorkspace(conn: Connection) {
  const state = useApp.getState();
  if (!state.syncFlags.files) return;
  const nodes = await collectFiles(conn, ".", 0);
  const files = { ...state.files };
  for (const node of nodes) {
    if (node.type !== "file") continue;
    if (!files[node.path]) files[node.path] = { path: node.path, content: "", original: "" };
  }
  if (Object.keys(files).length) {
    useApp.getState().applyFiles(files);
    const first = Object.keys(files).sort()[0];
    if (first && !state.openFile) useApp.getState().setOpenFile(first);
  }
  const status = await fileStatus(conn).catch(() => []);
  useApp.getState().setFileStatus(status);
}

export async function ensureFileLoaded(path: string) {
  const state = useApp.getState();
  const conn = state.connection;
  if (conn.kind === "offline" || !path) return;
  const existing = state.files[path];
  if (existing && existing.content) return;
  try {
    const content = await readRemoteFile(conn, path);
    useApp.getState().upsertFile({
      path,
      content,
      original: existing?.original || content,
    });
  } catch {
    /* keep stub */
  }
}

export async function refreshActiveMessages(sessionId: string) {
  const conn = useApp.getState().connection;
  if (conn.kind === "offline" || !sessionId) return;
  const session = useApp.getState().sessions.find((s) => s.id === sessionId);
  if (session?.status === "running") return;
  try {
    const messages = await listRemoteMessages(conn, sessionId);
    if (messages.length) useApp.getState().setSessionMessages(sessionId, messages);
  } catch {
    /* keep current */
  }
}

export async function runSync(direction: "pull" | "boot") {
  const state = useApp.getState();
  if (state.connection.kind === "offline") {
    state.setHost({ ok: false, kind: "offline", version: "", label: "未连接", error: "未连接" });
    state.setLive({ connected: false, lastEventType: null });
    return;
  }
  state.setSyncing(true);
  try {
    const health = await probeConnection(state.connection);
    state.setHost(health);
    if (!health.ok) {
      state.markSynced(health.error ?? "未连接");
      return;
    }
    const models = await fetchProviders(state.connection).catch(() => []);
    const configured = await fetchDefaultModel(state.connection).catch(() => null);
    if (models.length) state.setHostModels(models);
    const pick =
      (configured && (models.length === 0 || models.some((m) => m.id === configured)) ? configured : null) ??
      models.find((m) => /xai\/grok-4\.5$/i.test(m.id))?.id ??
      models[0]?.id;

    const project = await fetchProject(state.connection).catch(() => null);
    if (project) state.setProjectMeta(project.name, project.branch);

    if (state.syncFlags.sessions) {
      let sessions = await listRemoteSessions(state.connection);
      if (!sessions.length) {
        const created = await createRemoteSession(state.connection);
        sessions = [created];
      }
      const current = useApp.getState();
      const active =
        sessions.find((s) => s.id === current.activeSessionId)?.id ?? sessions[0]?.id ?? "";
      current.applySessions(
        sessions.map((s) => {
          const prev = current.sessions.find((p) => p.id === s.id);
          return prev
            ? { ...s, messages: prev.messages, mode: prev.mode, model: prev.model || pick || s.model }
            : { ...s, model: s.model || pick || "" };
        }),
        active,
      );
      if (active) await refreshActiveMessages(active);
    } else if (pick) {
      const current = useApp.getState();
      const active = current.sessions.find((s) => s.id === current.activeSessionId);
      if (active && !active.model) current.setModel(pick);
    }

    if (state.syncFlags.files) await loadWorkspace(state.connection);
    useApp.getState().markSynced(`已接通 · ${health.label}`);
  } catch (err) {
    state.setHost({
      ok: false,
      kind: state.connection.kind,
      version: "",
      label: state.connection.kind === "local" ? "本机 OpenCode" : state.connection.url,
      error: err instanceof Error ? err.message : "同步失败",
    });
    state.markSynced(err instanceof Error ? err.message : "同步失败");
  }
}

export function RemoteBridge() {
  const connection = useApp((s) => s.connection);
  const handle = useRef<LiveHandle | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = (useApp as unknown as {
      persist?: {
        hasHydrated: () => boolean;
        onFinishHydration: (cb: () => void) => () => void;
      };
    }).persist;

    const finish = () => {
      const state = useApp.getState();
      const saved = state.connection;
      if (saved.url.trim()) {
        if (saved.kind !== "remote") state.setConnection({ kind: "remote" });
      } else if (isNativeShell()) {
        state.setMobileTab("link");
        if (saved.kind === "local") state.setConnection({ kind: "offline" });
      }
      setHydrated(true);
    };

    if (!persist || persist.hasHydrated()) {
      finish();
      return;
    }
    return persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    handle.current?.stop();
    handle.current = null;
    if (connection.kind === "offline") {
      useApp.getState().setLive({ connected: false, lastEventType: null });
      useApp.getState().setHost({ ok: false, kind: "offline", version: "", label: "未连接" });
      return;
    }
    void runSync("boot").then(() => {
      handle.current = startLive(connection);
    });
    return () => {
      handle.current?.stop();
      handle.current = null;
    };
  }, [hydrated, connection.kind, connection.url, connection.username, connection.password]);

  const activeId = useApp((s) => s.activeSessionId);
  useEffect(() => {
    if (!hydrated || !activeId) return;
    void refreshActiveMessages(activeId);
  }, [hydrated, activeId]);

  return null;
}
