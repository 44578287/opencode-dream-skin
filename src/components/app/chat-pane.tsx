import { FileCode2, FolderSearch, Pencil, Terminal } from "lucide-react";
import { Markdown } from "./markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { findTheme, useApp, type ChatMessage, type ToolCall } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ChatPane({
  messages,
  running,
}: {
  messages: ChatMessage[];
  running: boolean;
}) {
  const themeId = useApp((s) => s.themeId);
  const customThemes = useApp((s) => s.customThemes);
  const theme = findTheme(themeId);
  const skin = theme.dreamSkin;
  void customThemes;

  if (!messages.length && !running) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" data-ds-part="home">
        {skin ? (
          <>
            <p className="ds-eyebrow text-[11px] font-medium uppercase">{skin.name}</p>
            <p className="ds-empty-quote mt-4 max-w-md text-3xl font-medium tracking-tight text-balance sm:text-4xl" data-ds-part="home-hero">
              {skin.quote ?? "MAKE SOMETHING WONDERFUL"}
            </p>
            <p className="mt-3 max-w-sm text-sm text-muted text-pretty">{skin.tagline}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-2xl font-medium tracking-tight text-balance">opencode</p>
            <p className="mt-2 max-w-sm text-sm text-muted text-pretty">
              对当前工作区提问，或切换到规划模式先看方案。
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
        {messages.map((m) => (
          <MessageBlock key={m.id} message={m} />
        ))}
        {running && !messages.some((m) => m.streaming) ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="shimmer bg-clip-text text-transparent">正在读取工作区并思考</span>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function MessageBlock({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-md bg-element px-3 py-2 text-[13px] leading-relaxed" data-ds-part="message">
        {message.content}
      </div>
    );
  }
  return (
    <div className="space-y-2" data-ds-part="message">
      {message.tools?.length ? (
        <div className="space-y-1.5">
          {message.tools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      ) : null}
      {message.content ? <Markdown text={message.content} /> : null}
      {message.streaming ? <span className="inline-block h-3 w-1.5 translate-y-0.5 bg-primary/80" /> : null}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolCall }) {
  const Icon = tool.name === "write_file" ? Pencil : tool.name === "list_files" ? FolderSearch : tool.name === "read_file" ? FileCode2 : Terminal;
  return (
    <div className="flex items-start gap-2 rounded-sm border border-border bg-background/40 px-2.5 py-1.5">
      <Icon className="mt-0.5 size-3.5 text-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-foreground">{tool.name}</span>
          <Badge tone={tool.status === "error" ? "error" : "muted"}>{tool.status === "ok" ? "完成" : tool.status === "error" ? "失败" : "进行中"}</Badge>
        </div>
        {tool.args.path ? <p className="truncate font-mono text-[11px] text-muted">{tool.args.path}</p> : null}
        {tool.result ? (
          <p className={cn("truncate font-mono text-[11px]", tool.status === "error" ? "text-error" : "text-muted")}>
            {tool.result.split("\n")[0]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
