import { useState } from "react";
import { ArrowUp, Bot, Hammer, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODELS, useApp, type AgentMode } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Composer({ onSend, disabled, compact }: { onSend: (text: string) => void; disabled?: boolean; compact?: boolean }) {
  const [value, setValue] = useState("");
  const session = useApp((s) => s.sessions.find((x) => x.id === s.activeSessionId));
  const setMode = useApp((s) => s.setMode);
  const setModel = useApp((s) => s.setModel);
  const mode = session?.mode ?? "build";
  const hostModels = useApp((s) => s.hostModels);
  const model = session?.model ?? hostModels[0]?.id ?? "grok-4.5";
  const models = hostModels.length
    ? hostModels
    : MODELS.map((m) => ({ id: m.id, label: m.label, provider: "xai" }));

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <div className={cn("border-t border-border bg-panel", compact ? "p-2" : "p-2 sm:p-3")} data-ds-part="composer">
      <div className="ds-composer-box mx-auto max-w-3xl rounded-md border border-border bg-background p-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={compact ? 1 : 2}
          placeholder={mode === "plan" ? "描述要规划的改动…" : "描述要构建的改动…"}
          className="w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-0.5" data-ds-part="composer-toolbar">
          <div className="flex items-center gap-1">
            <ModeSwitch mode={mode} onChange={setMode} />
            <label className="ml-1 flex items-center gap-1 text-[11px] text-muted">
              <Bot className="size-3.5" />
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-transparent text-[11px] text-foreground focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-panel">
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button size="sm" onClick={submit} disabled={disabled || !value.trim()} className="rounded-full px-3">
            发送
            <ArrowUp className="size-3.5" />
          </Button>
        </div>
      </div>
      {compact ? null : (
        <p className="mx-auto mt-1.5 max-w-3xl px-1 text-[11px] text-muted">
          Enter 发送 · Shift+Enter 换行 · ⌘K 命令 · ⌘T 主题
        </p>
      )}
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: AgentMode; onChange: (m: AgentMode) => void }) {
  return (
    <div className="flex rounded-full bg-element p-0.5">
      {(
        [
          { id: "plan", label: "规划", Icon: Map },
          { id: "build", label: "构建", Icon: Hammer },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
            mode === item.id ? "bg-background text-foreground" : "text-muted hover:text-foreground",
          )}
        >
          <item.Icon className="size-3" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
