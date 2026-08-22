import { Cloud, CloudOff, FolderGit2, MessageSquare, Palette, Plus, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findTheme, useApp, type MobileTab } from "@/lib/store";
import { ChatPane } from "./chat-pane";
import { Composer } from "./composer";
import { SidebarPane } from "./sidebar-pane";
import { EditorPane } from "./editor-pane";
import { ThemeStudio } from "./theme-studio";
import { ConnectPane } from "./connect-pane";
import { LivePrompts } from "./live-prompts";
import { cn } from "@/lib/utils";

const TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "会话", icon: MessageSquare },
  { id: "workspace", label: "工作区", icon: FolderGit2 },
  { id: "link", label: "连接", icon: Radio },
  { id: "skin", label: "皮肤", icon: Palette },
];

export function MobileShell({ onSend, sending }: { onSend: (text: string) => void; sending: boolean }) {
  const tab = useApp((s) => s.mobileTab);
  const setTab = useApp((s) => s.setMobileTab);
  const sessions = useApp((s) => s.sessions);
  const activeId = useApp((s) => s.activeSessionId);
  const session = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const setActive = useApp((s) => s.setActiveSession);
  const newSession = useApp((s) => s.newSession);
  const theme = findTheme(useApp((s) => s.themeId));
  const host = useApp((s) => s.host);
  const connection = useApp((s) => s.connection);
  const online = Boolean(host?.ok && connection.kind !== "offline");

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
      <header
        className="flex shrink-0 items-center gap-2 border-b border-border px-3"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        data-ds-part="header"
      >
        <div className="min-w-0 flex-1 py-2">
          <p className="ds-eyebrow truncate text-[10px] font-medium uppercase">{theme.dreamSkin?.statusText ?? "OPENCODE"}</p>
          <p className="truncate text-sm font-medium">{session?.title ?? "新会话"}</p>
        </div>
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[10px]", online ? "bg-element text-primary" : "text-muted")}>
          {online ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
          {online ? "已同步" : "本机"}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={newSession} aria-label="新会话">
          <Plus className="size-4" />
        </Button>
      </header>

      {tab === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {sessions.length > 1 ? (
            <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5" data-ds-part="project-list">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "max-w-40 shrink-0 truncate rounded-full px-2.5 py-1 text-[11px]",
                    s.id === activeId ? "bg-element text-foreground" : "text-muted",
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="min-h-0 flex-1" data-ds-part="thread">
            <ChatPane messages={session?.messages ?? []} running={sending} />
          </div>
          <LivePrompts sessionId={session?.id} />
          <Composer onSend={onSend} disabled={false} compact />
        </div>
      ) : null}

      {tab === "workspace" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 basis-1/2 overflow-hidden" data-ds-part="sidebar">
            <SidebarPane />
          </div>
          <div className="min-h-0 flex-1 basis-1/2 overflow-hidden border-t border-border" data-ds-part="main">
            <EditorPane />
          </div>
        </div>
      ) : null}

      {tab === "link" ? <ConnectPane /> : null}
      {tab === "skin" ? <ThemeStudio variant="page" /> : null}

      <nav
        className="grid grid-cols-4 border-t border-border"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
        data-ds-chrome
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              if (item.id === "workspace") useApp.getState().setRail("files");
              if (item.id === "chat") useApp.getState().setRail("sessions");
            }}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]",
              tab === item.id ? "text-foreground" : "text-muted",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
