import { useEffect, useState } from "react";
import { Cloud, CloudOff, LoaderCircle, RefreshCw, Server, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { runSync } from "./remote-bridge";
import { AndroidClientCard } from "./android-client";
import { isNativeShell } from "@/lib/remote/types";
import { cn } from "@/lib/utils";

function ago(ts: number | null) {
  if (!ts) return "尚未同步";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
  return `${Math.round(s / 3600)} 小时前`;
}

export function ConnectPane() {
  const connection = useApp((s) => s.connection);
  const setConnection = useApp((s) => s.setConnection);
  const syncFlags = useApp((s) => s.syncFlags);
  const setSyncFlags = useApp((s) => s.setSyncFlags);
  const host = useApp((s) => s.host);
  const syncing = useApp((s) => s.syncing);
  const lastSyncAt = useApp((s) => s.lastSyncAt);
  const lastSyncNote = useApp((s) => s.lastSyncNote);
  const live = useApp((s) => s.live);
  const [url, setUrl] = useState(connection.url);
  const [username, setUsername] = useState(connection.username);
  const [password, setPassword] = useState(connection.password);
  const [origin, setOrigin] = useState("");
  const native = typeof window !== "undefined" && isNativeShell();

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const online = Boolean(host?.ok && connection.kind !== "offline");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-4 py-4" data-ds-part="home">
      <AndroidClientCard />

      <div className="mt-3 rounded-md border border-border bg-panel/70 p-4">
        <div className="flex items-center gap-2">
          {online ? <Cloud className="size-4 text-primary" /> : <CloudOff className="size-4 text-muted" />}
          <p className="text-sm font-medium">{online ? host?.label : "未连接主机"}</p>
          <Badge tone={live.connected ? "success" : online ? "primary" : "muted"}>
            {live.connected ? "实时流" : online ? "在线" : "离线"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {host?.version ? `OpenCode ${host.version}` : "官方 HTTP / SSE：会话、文件、搜索、权限、提问走同一条通道。"}
        </p>
        {host?.error && !online ? <p className="mt-2 text-xs text-error">{host.error}</p> : null}
        <p className="mt-2 text-xs text-accent">{syncing ? "正在同步…" : lastSyncNote ?? ago(lastSyncAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runSync("pull")} disabled={syncing || connection.kind === "offline"}>
            <RefreshCw className={cn("size-3.5", syncing ? "animate-spin" : "")} />
            重新同步
          </Button>
        </div>
      </div>

      <p className="mt-5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">同步内容</p>
      <div className="flex flex-col gap-1">
        {(
          [
            ["theme", "主题名"],
            ["sessions", "会话"],
            ["files", "工作区文件"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-3 rounded-sm px-1">
            <input
              type="checkbox"
              checked={syncFlags[key]}
              onChange={(e) => setSyncFlags({ [key]: e.target.checked })}
              className="size-4 accent-primary"
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      <p className="mt-5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">主机</p>
      <div className="flex flex-col gap-2">
        {native ? null : (
          <button
            type="button"
            onClick={() => {
              setConnection({ kind: "local" });
            }}
            className={cn(
              "min-h-11 rounded-md border px-3 py-2 text-left text-sm",
              connection.kind === "local" ? "border-border-active bg-element" : "border-border",
            )}
          >
            <span className="flex items-center gap-2">
              <Server className="size-3.5" />
              本机 Grok 引擎
            </span>
            <span className="mt-0.5 block text-[11px] text-muted">
              直接用这台服务器上的 Grok 4.5 读写工作区。写入和命令会先问权限。
            </span>
          </button>
        )}

        <div className="rounded-md border border-border p-3">
          <p className="text-sm">OpenCode 主机</p>
          <p className="mt-1 text-[11px] text-muted">
            在电脑上运行{" "}
            <code className="rounded-sm bg-element px-1">
              opencode serve --port 4096 --cors {origin || "https://localhost"}
            </code>
            ，然后填入地址。手机请用电脑的局域网 IP。
          </p>
          <Input
            className="mt-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.8:4096"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" autoCapitalize="none" />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（可选）" />
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setConnection({ kind: "remote", url: url.trim(), username, password });
              }}
              disabled={syncing || !url.trim()}
            >
              {syncing ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              连接
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setConnection({ kind: "offline", url: "", password: "" });
                useApp.getState().setHost({ ok: false, kind: "offline", version: "", label: "未连接" });
                useApp.getState().applySessions([], "");
                useApp.getState().applyFiles({});
                useApp.getState().setLive({ connected: false, lastEventType: null });
              }}
            >
              <Unplug className="size-3.5" />
              断开
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
