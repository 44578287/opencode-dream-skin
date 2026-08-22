import { ShieldAlert, HelpCircle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { abortSession, replyPermission, replyQuestion, rejectQuestion } from "@/lib/remote/live";
import type { PermissionRequest, QuestionRequest } from "@/lib/remote/events";
import { cn } from "@/lib/utils";

export function LivePrompts({ sessionId }: { sessionId?: string }) {
  const connection = useApp((s) => s.connection);
  const permissions = useApp((s) => s.permissions);
  const questions = useApp((s) => s.questions);
  const mineP = permissions.filter((p) => !sessionId || p.sessionID === sessionId);
  const otherP = permissions.filter((p) => sessionId && p.sessionID !== sessionId);
  const mineQ = questions.filter((q) => !sessionId || q.sessionID === sessionId);
  const otherQ = questions.filter((q) => sessionId && q.sessionID !== sessionId);
  const session = useApp((s) => s.sessions.find((x) => x.id === sessionId));
  const running = session?.status === "running";

  if (!mineP.length && !mineQ.length && !otherP.length && !otherQ.length && !running) return null;

  return (
    <div className="space-y-2 border-t border-border bg-panel/80 px-3 py-2" data-ds-part="dialog">
      {running && !mineP.length && !mineQ.length ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>主机正在往这条流里推事件</span>
          {sessionId ? (
            <Button size="sm" variant="ghost" onClick={() => void abortSession(connection, sessionId)}>
              <Square className="size-3" />
              停
            </Button>
          ) : null}
        </div>
      ) : null}
      {otherP.map((p) => (
        <button
          key={p.id}
          type="button"
          className="w-full rounded-sm border border-border px-3 py-2 text-left text-xs text-muted"
          onClick={() => useApp.getState().setActiveSession(p.sessionID)}
        >
          另一个会话在等权限：{p.permission} · 点这里切过去
        </button>
      ))}
      {otherQ.map((q) => (
        <button
          key={q.id}
          type="button"
          className="w-full rounded-sm border border-border px-3 py-2 text-left text-xs text-muted"
          onClick={() => useApp.getState().setActiveSession(q.sessionID)}
        >
          另一个会话在提问 · 点这里切过去
        </button>
      ))}
      {mineP.map((p) => (
        <PermissionCard
          key={p.id}
          request={p}
          onReply={(reply) => void replyPermission(connection, p.sessionID, p.id, reply)}
        />
      ))}
      {mineQ.map((q) => (
        <QuestionCard
          key={q.id}
          request={q}
          onReply={(answers) => void replyQuestion(connection, q.id, answers)}
          onReject={() => void rejectQuestion(connection, q.id)}
        />
      ))}
    </div>
  );
}

function PermissionCard({
  request,
  onReply,
}: {
  request: PermissionRequest;
  onReply: (reply: "once" | "always" | "reject") => void;
}) {
  const path = request.patterns[0] ?? request.permission;
  const note = typeof request.metadata?.description === "string" ? request.metadata.description : null;
  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">主机要权限：{request.permission}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{path}</p>
          {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => onReply("once")}>
          这次允许
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onReply("always")}>
          本会话都允许
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onReply("reject")}>
          拒绝
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  request,
  onReply,
  onReject,
}: {
  request: QuestionRequest;
  onReply: (answers: string[][]) => void;
  onReject: () => void;
}) {
  const q = request.questions[0];
  if (!q) return null;
  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="mt-0.5 size-4 text-primary" />
        <div className="min-w-0 flex-1">
          {q.header ? <p className="text-[11px] uppercase tracking-wider text-muted">{q.header}</p> : null}
          <p className="text-sm font-medium">{q.question}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {q.options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onReply([[opt.label]])}
            className={cn(
              "rounded-sm border border-border px-3 py-2 text-left text-sm hover:bg-element",
            )}
          >
            <span className="font-medium">{opt.label}</span>
            {opt.description ? <span className="mt-0.5 block text-[11px] text-muted">{opt.description}</span> : null}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={onReject}>
          跳过
        </Button>
      </div>
    </div>
  );
}
