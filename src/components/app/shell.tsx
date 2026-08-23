import { useEffect, useState } from "react";
import {
  Files,
  GitBranch,
  MessageSquare,
  Palette,
  Search,
  Settings2,
  SquareTerminal,
} from "lucide-react";
import { Group, Panel, Separator as ResizeSep } from "react-resizable-panels";
import { Tooltip } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { findTheme, useApp, type ChatMessage, type RailId } from "@/lib/store";
import { changedFiles } from "@/lib/workspace";
import { cn, uid } from "@/lib/utils";
import { ChatPane } from "./chat-pane";
import { Composer } from "./composer";
import { SidebarPane } from "./sidebar-pane";
import { EditorPane } from "./editor-pane";
import { ThemeStudio } from "./theme-studio";
import { CommandPalette } from "./command-palette";
import { MobileShell } from "./mobile-shell";
import { ConnectPane } from "./connect-pane";
import { RemoteBridge } from "./remote-bridge";
import { NotifyBridge } from "./notify-bridge";
import { LivePrompts } from "./live-prompts";
import { sendPrompt, runShell } from "@/lib/remote/live";
import { createRemoteSession, deleteRemoteSession } from "@/lib/remote/client";

const RAILS: { id: RailId; label: string; icon: typeof Files }[] = [
  { id: "sessions", label: "会话", icon: MessageSquare },
  { id: "files", label: "文件", icon: Files },
  { id: "search", label: "搜索", icon: Search },
  { id: "git", label: "更改", icon: GitBranch },
];

export function DesktopShell() {
  const sessions = useApp((s) => s.sessions);
  const activeId = useApp((s) => s.activeSessionId);
  const session = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const setActive = useApp((s) => s.setActiveSession);
  const closeSession = useApp((s) => s.closeSession);
  const rail = useApp((s) => s.rail);
  const setRail = useApp((s) => s.setRail);
  const themeId = useApp((s) => s.themeId);
  const appearance = useApp((s) => s.appearance);
  const files = useApp((s) => s.files);
  const appendMessage = useApp((s) => s.appendMessage);
  const patchSession = useApp((s) => s.patchSession);
  const connection = useApp((s) => s.connection);
  const live = useApp((s) => s.live);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const setThemeOpen = useApp((s) => s.setThemeOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const terminalOpen = useApp((s) => s.terminalOpen);
  const setTerminalOpen = useApp((s) => s.setTerminalOpen);
  const theme = findTheme(themeId);
  const dirty = changedFiles(files).length;
  const host = useApp((s) => s.host);
  const projectName = useApp((s) => s.projectName);
  const projectBranch = useApp((s) => s.projectBranch);

  async function ensureSession() {
    const conn = useApp.getState().connection;
    if (conn.kind === "offline") {
      useApp.getState().setSettingsOpen(true);
      useApp.getState().setMobileTab("link");
      throw new Error("请先连接主机");
    }
    const current = useApp.getState();
    const existing = current.sessions.find((s) => s.id === current.activeSessionId);
    if (existing) return existing;
    const created = await createRemoteSession(conn);
    useApp.getState().hydrateSession(created);
    useApp.getState().setActiveSession(created.id);
    return created;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (meta && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setThemeOpen(true);
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void onNew();
      }
      if (e.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, setThemeOpen]);

  async function onNew() {
    const conn = useApp.getState().connection;
    if (conn.kind === "offline") {
      useApp.getState().setSettingsOpen(true);
      useApp.getState().setMobileTab("link");
      return;
    }
    try {
      const created = await createRemoteSession(conn);
      useApp.getState().hydrateSession(created);
      useApp.getState().setActiveSession(created.id);
    } catch (err) {
      useApp.getState().setHost({
        ok: false,
        kind: conn.kind,
        version: "",
        label: conn.kind === "local" ? "本机 OpenCode" : conn.url,
        error: err instanceof Error ? err.message : "无法创建会话",
      });
    }
  }

  async function onClose(id: string) {
    const conn = useApp.getState().connection;
    if (conn.kind !== "offline") {
      await deleteRemoteSession(conn, id).catch(() => undefined);
    }
    closeSession(id);
  }

  async function send(text: string) {
    let session;
    try {
      session = await ensureSession();
    } catch {
      return;
    }
    const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: text, createdAt: Date.now() };
    appendMessage(session.id, userMsg);
    if (session.title === "新会话") patchSession(session.id, { title: text.slice(0, 28) });
    patchSession(session.id, { status: "running" });
    try {
      await sendPrompt(connection, session.id, text, { model: session.model, agent: session.mode });
    } catch (err) {
      appendMessage(session.id, {
        id: uid("msg"),
        role: "assistant",
        content: err instanceof Error ? err.message : "没发出去。",
        createdAt: Date.now(),
      });
      patchSession(session.id, { status: "error" });
    }
  }

  const sending = session?.status === "running";

  return (
    <div className="desktop-scene flex min-h-dvh items-stretch justify-center p-0 md:p-5">
      <div className="desktop-window flex min-h-dvh w-full max-w-[1440px] flex-col overflow-hidden rounded-none border-0 bg-panel shadow-none md:min-h-[calc(100dvh-2.5rem)] md:rounded-lg md:border md:border-border md:shadow-window" data-ds-part="root">
        <div className="ds-wallpaper" aria-hidden="true" />
        <Titlebar
          sessions={sessions}
          activeId={activeId}
          onSelect={setActive}
          onNew={onNew}
          onClose={(id) => void onClose(id)}
          themeName={theme.name}
          statusText={theme.dreamSkin?.statusText}
          hostLabel={live.connected ? (host?.label ?? "事件流") : host?.ok ? host.label : undefined}
          live={live.connected}
          onTheme={() => setThemeOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2 md:flex" data-ds-chrome>
            {RAILS.map((item) => (
              <Tooltip key={item.id} content={item.label}>
                <button
                  type="button"
                  onClick={() => setRail(item.id)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-sm",
                    rail === item.id ? "bg-element text-foreground" : "text-muted hover:text-foreground",
                  )}
                  aria-label={item.label}
                >
                  <item.icon className="size-4" />
                </button>
              </Tooltip>
            ))}
            <div className="mt-auto flex flex-col gap-1">
              <Tooltip content="终端">
                <button
                  type="button"
                  onClick={() => setTerminalOpen(!terminalOpen)}
                  className={cn("flex size-9 items-center justify-center rounded-sm", terminalOpen ? "bg-element text-foreground" : "text-muted hover:text-foreground")}
                  aria-label="终端"
                >
                  <SquareTerminal className="size-4" />
                </button>
              </Tooltip>
              <Tooltip content="设置">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex size-9 items-center justify-center rounded-sm text-muted hover:text-foreground"
                  aria-label="设置"
                >
                  <Settings2 className="size-4" />
                </button>
              </Tooltip>
            </div>
          </nav>

          <div className="hidden min-h-0 w-56 shrink-0 border-r border-border md:flex md:flex-col" data-ds-part="sidebar">
            <SidebarPane />
          </div>
          <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
            <Group orientation="horizontal" className="h-full min-h-0 w-full">
              <Panel id="chat" defaultSize="56" minSize="32" className="h-full min-w-0 overflow-hidden">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="min-h-0 flex-1" data-ds-part="thread">
                    <ChatPane messages={session?.messages ?? []} running={sending} />
                  </div>
                  <LivePrompts sessionId={session?.id} />
                  <Composer onSend={send} disabled={connection.kind === "offline"} />
                </div>
              </Panel>
              <ResizeSep className="w-px bg-border hover:bg-primary" />
              <Panel id="editor" defaultSize="44" minSize="28" className="h-full min-w-0 overflow-hidden">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="min-h-0 flex-1">
                    <EditorPane />
                  </div>
                  {terminalOpen ? <TerminalStrip sessionId={session?.id} /> : null}
                </div>
              </Panel>
            </Group>
          </div>

          <MobileShell onSend={send} sending={sending} onNew={() => void onNew()} />
        </div>

        <footer className="hidden h-7 items-center justify-between gap-3 border-t border-border px-3 text-[11px] text-muted md:flex" data-ds-chrome>
          <div className="flex items-center gap-3">
            <span className="font-medium text-foreground">{projectName}</span>
            <span>{projectBranch}</span>
            <span>{dirty ? `${dirty} 处更改` : "干净"}</span>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="hover:text-foreground" onClick={() => setSettingsOpen(true)}>
              {live.connected ? `实时流 · ${host?.label ?? "已接通"}` : connection.kind === "offline" ? "未连接" : "连接中"}
            </button>
            <span>{appearance === "dark" ? "暗色" : "亮色"}</span>
            <button type="button" className="hover:text-foreground" onClick={() => setThemeOpen(true)}>
              {theme.name}
            </button>
            <span>{session?.mode === "plan" ? "规划" : "构建"}</span>
            <span>{session?.model}</span>
          </div>
        </footer>
      </div>
      <ThemeStudio />
      <CommandPalette />
      <RemoteBridge />
      <NotifyBridge />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent title="设置" className="max-h-[min(88vh,720px)] overflow-hidden p-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none">
          <div className="max-h-[min(80vh,640px)] overflow-auto">
            <div className="space-y-3 border-b border-border px-4 pb-3 text-sm">
              <p className="text-muted">
                这是 OpenCode 的远程客户端。在连接页填一次主机地址，之后打开就会直连。模型、密钥都在 OpenCode 里配，这里不用填。
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge>直连 OpenCode</Badge>
                <Badge>Dream Skin</Badge>
                <Badge>实时事件流</Badge>
              </div>
            </div>
            <ConnectPane />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Titlebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onClose,
  themeName,
  statusText,
  hostLabel,
  live,
  onTheme,
}: {
  sessions: { id: string; title: string; status: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
  themeName: string;
  statusText?: string;
  hostLabel?: string;
  live?: boolean;
  onTheme: () => void;
}) {
  return (
    <header className="hidden h-11 shrink-0 items-center gap-3 border-b border-border px-3 md:flex" data-ds-part="header">
      <div className="hidden items-center gap-1.5 md:flex">
        <span className="size-2.5 rounded-full bg-error/80" />
        <span className="size-2.5 rounded-full bg-warning/80" />
        <span className="size-2.5 rounded-full bg-success/80" />
      </div>
      <p className="hidden font-mono text-[12px] text-muted sm:block">opencode</p>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "group flex max-w-48 items-center gap-1.5 rounded-sm px-2 py-1 text-[12px]",
              s.id === activeId ? "bg-element text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span className={cn("size-1.5 rounded-full", s.status === "running" ? "bg-primary" : "bg-muted")} />
            <span className="truncate">{s.title}</span>
            {sessions.length > 1 ? (
              <span
                className="text-muted opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(s.id);
                }}
              >
                ×
              </span>
            ) : null}
          </button>
        ))}
        <button type="button" onClick={onNew} className="px-1.5 text-muted hover:text-foreground" aria-label="新会话">
          +
        </button>
      </div>
      {hostLabel ? (
        <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted lg:inline-flex">
          <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted")} />
          {live ? `实时 · ${hostLabel}` : hostLabel}
        </span>
      ) : null}
      {statusText ? (
        <span className="hidden items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-primary md:flex">
          <span className="size-1.5 rounded-full bg-primary" />
          {statusText}
        </span>
      ) : null}
      <button type="button" onClick={onTheme} className="hidden items-center gap-1 rounded-full bg-element px-2 py-1 text-[11px] text-muted hover:text-foreground sm:flex">
        <Palette className="size-3" />
        {themeName}
      </button>
    </header>
  );
}

function TerminalStrip({ sessionId }: { sessionId?: string }) {
  const files = useApp((s) => s.files);
  const dirty = changedFiles(files).length;
  const connection = useApp((s) => s.connection);
  const projectName = useApp((s) => s.projectName);
  const [cmd, setCmd] = useState("");
  const [log, setLog] = useState<string[]>([`~/ ${projectName}`, dirty ? `${dirty} file(s) modified` : "working tree clean"]);

  async function run() {
    const text = cmd.trim();
    if (!text || !sessionId) return;
    setLog((prev) => [...prev.slice(-20), `❯ ${text}`]);
    setCmd("");
    try {
      await runShell(connection, sessionId, text);
    } catch (err) {
      setLog((prev) => [...prev, err instanceof Error ? err.message : "命令失败"]);
    }
  }

  return (
    <div className="h-36 border-t border-border bg-background px-3 py-2 font-mono text-[12px] leading-6 text-muted">
      <div className="h-24 overflow-auto">
        {log.map((line, i) => (
          <p key={i} className={line.startsWith("❯") ? "text-foreground" : ""}>
            {line}
          </p>
        ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <span className="text-primary">❯</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
          placeholder="在工作区里执行命令，回车后先问权限"
        />
      </form>
    </div>
  );
}
