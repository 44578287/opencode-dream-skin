import { useState } from "react";
import { Cloud, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { runSync } from "./remote-bridge";
import { AndroidClientCard } from "./android-client";
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

  const online = connection.kind === "demo" || Boolean(host?.ok);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-4 py-4" data-ds-part="home">
      <AndroidClientCard />
      <div className="mt-3 rounded-md border border-border bg-panel/70 p-4">
        <div className="flex items-center gap-2">
          {online ? <Cloud className="size-4 text-primary" /> : <CloudOff className="size-4 text-muted" />}
          <p className="text-sm font-medium">{online ? host?.label : "未连接主机"}</p>
          <Badge tone={online ? "primary" : "muted"}>{live.connected ? "实时流" : online ? "在线" : "离线"}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {host?.version ? `OpenCode ${host.version}` : "连上主机后走官方事件流：正文、工具、权限、提问都是同一条实时通道。"}
        </p>
        <p className="mt-2 text-xs text-accent">{syncing ? "正在同步…" : lastSyncNote ?? ago(lastSyncAt)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runSync("pull")} disabled={syncing || connection.kind === "offline"}>
            <RefreshCw className={cn("size-3.5", syncing ? "animate-spin" : "")} />
            补齐会话列表
          </Button>
        </div>
      </div>

      <p className="mt-5 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">同步内容</p>
      <div className="flex flex-col gap-1">
        {(
          [
            ["theme", "主题名（连接时对齐一次）"],
            ["sessions", "会话列表（连接时对齐，之后走事件）"],
            ["files", "工作区文件（连接时对齐）"],
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
        <button
          type="button"
          onClick={() => {
            setConnection({ kind: "demo" });
            void runSync("boot");
          }}
          className={cn(
            "min-h-11 rounded-md border px-3 py-2 text-left text-sm",
            connection.kind === "demo" ? "border-border-active bg-element" : "border-border",
          )}
        >
          演示主机
          <span className="mt-0.5 block text-[11px] text-muted">预览用的实时总线：发一句就能看到流式正文、权限和提问。</span>
        </button>
        <div className="rounded-md border border-border p-3">
          <p className="text-sm">自己的 OpenCode</p>
          <p className="mt-1 text-[11px] text-muted">填 OpenCode 主机地址。连上后订阅官方事件流，权限和提问会弹到对话里。</p>
          <Input className="mt-2" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="主机地址" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setConnection({ kind: "remote", url, username, password });
                void runSync("boot");
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
                setConnection({ kind: "offline" });
                useApp.getState().setHost({ ok: false, kind: "offline", version: "", label: "未连接" });
              }}
            >
              断开
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
