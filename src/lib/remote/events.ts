/** OpenCode host bus events (GET /event). Shapes match official schema v1. */

export type PermissionReply = "once" | "always" | "reject";

export type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  always: string[];
  metadata?: Record<string, unknown>;
  tool?: { messageID: string; callID: string };
};

export type QuestionOption = { label: string; description?: string };

export type QuestionInfo = {
  question: string;
  header?: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
};

export type HostEvent =
  | { type: "server.connected"; properties?: Record<string, unknown> }
  | { type: "session.updated"; properties: { info: { id: string; title?: string; time?: { updated?: number } } } }
  | { type: "session.deleted"; properties: { info: { id: string } } }
  | { type: "session.status"; properties: { sessionID: string; status: { type?: string } | string } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | { type: "session.error"; properties: { sessionID: string; error?: { message?: string } } }
  | {
      type: "message.updated";
      properties: {
        info: {
          id: string;
          sessionID: string;
          role: "user" | "assistant" | "tool";
          time?: { created?: number; completed?: number };
        };
      };
    }
  | { type: "message.removed"; properties: { sessionID: string; messageID: string } }
  | {
      type: "message.part.updated";
      properties: {
        part: {
          id: string;
          sessionID: string;
          messageID: string;
          type: string;
          text?: string;
          name?: string;
          tool?: string;
          state?: { status?: string; title?: string; output?: string };
        };
      };
    }
  | {
      type: "message.part.delta";
      properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string };
    }
  | { type: "permission.asked"; properties: PermissionRequest }
  | { type: "permission.replied"; properties: { sessionID: string; requestID: string; reply: PermissionReply } }
  | { type: "question.asked"; properties: QuestionRequest }
  | { type: "question.replied"; properties: { sessionID: string; requestID: string; answers: string[][] } }
  | { type: "question.rejected"; properties: { sessionID: string; requestID: string } };

export function asSessionStatus(status: { type?: string } | string | undefined): "idle" | "running" | "error" {
  const t = typeof status === "string" ? status : status?.type ?? "";
  if (t === "error" || t === "fail") return "error";
  if (t === "idle" || t === "completed") return "idle";
  if (t === "busy" || t === "busy.working" || t === "working" || t === "running" || t === "compacting") return "running";
  return "running";
}
