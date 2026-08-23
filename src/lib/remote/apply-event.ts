import { uid } from "@/lib/utils";
import { useApp, type ChatMessage, type ToolCall } from "@/lib/store";
import { asSessionStatus, type HostEvent } from "./events";

function toolStatus(raw?: string): ToolCall["status"] {
  if (raw === "error" || raw === "failed") return "error";
  if (raw === "completed" || raw === "ok") return "ok";
  return "running";
}

function upsertMessage(sessionId: string, id: string, patch: Partial<ChatMessage>) {
  const state = useApp.getState();
  const session = state.sessions.find((s) => s.id === sessionId);
  const existing = session?.messages.find((m) => m.id === id);
  if (existing) {
    state.replaceMessage(sessionId, { ...existing, ...patch, id });
    return;
  }
  state.appendMessage(sessionId, {
    id,
    role: patch.role ?? "assistant",
    content: patch.content ?? "",
    tools: patch.tools,
    streaming: patch.streaming,
    createdAt: patch.createdAt ?? Date.now(),
  });
}

/** Apply one OpenCode bus event onto the local client. Incremental — never a full snapshot. */
export function applyHostEvent(event: HostEvent) {
  const state = useApp.getState();
  state.setLive({ connected: true, lastEventAt: Date.now(), lastEventType: event.type });

  switch (event.type) {
    case "server.connected":
      state.markSynced("事件流已接通");
      return;
    case "session.updated": {
      const info = event.properties.info;
      const found = state.sessions.find((s) => s.id === info.id);
      if (found) {
        state.patchSession(info.id, { title: info.title ?? found.title, updatedAt: info.time?.updated ?? Date.now() });
      } else {
        state.hydrateSession({
          id: info.id,
          title: info.title || "远程会话",
          mode: "build",
          model: useApp.getState().hostModels.find((m) => /grok-4\.5/i.test(m.id))?.id || useApp.getState().hostModels[0]?.id || "xai/grok-4.5",
          status: "idle",
          messages: [],
          updatedAt: info.time?.updated ?? Date.now(),
        });
      }
      return;
    }
    case "session.deleted": {
      const id = event.properties.info.id;
      const next = state.sessions.filter((s) => s.id !== id);
      const activeSessionId = state.activeSessionId === id ? (next[0]?.id ?? "") : state.activeSessionId;
      state.applySessions(next, activeSessionId);
      return;
    }
    case "session.status":
      state.patchSession(event.properties.sessionID, { status: asSessionStatus(event.properties.status) });
      return;
    case "session.idle":
      state.patchSession(event.properties.sessionID, { status: "idle" });
      state.finishStreaming(event.properties.sessionID);
      return;
    case "session.error":
      state.patchSession(event.properties.sessionID, { status: "error" });
      if (event.properties.error?.message) {
        upsertMessage(event.properties.sessionID, uid("msg"), {
          role: "assistant",
          content: event.properties.error.message,
        });
      }
      return;
    case "message.updated": {
      const info = event.properties.info;
      if (info.role === "user") {
        const session = state.sessions.find((s) => s.id === info.sessionID);
        const last = session?.messages.at(-1);
        if (last?.role === "user" && Date.now() - last.createdAt < 5000) return;
      }
      upsertMessage(info.sessionID, info.id, {
        role: info.role,
        streaming: info.role === "assistant" && !info.time?.completed,
        createdAt: info.time?.created,
      });
      if (info.role === "assistant" && !info.time?.completed) {
        state.patchSession(info.sessionID, { status: "running" });
      }
      return;
    }
    case "message.removed":
      state.removeMessage(event.properties.sessionID, event.properties.messageID);
      return;
    case "message.part.updated": {
      const part = event.properties.part;
      if (part.type === "text" && typeof part.text === "string") {
        upsertMessage(part.sessionID, part.messageID, { role: "assistant", content: part.text, streaming: true });
        return;
      }
      if (part.type === "tool" || part.tool || part.name) {
        const tool: ToolCall = {
          id: part.id,
          name: part.name || part.tool || "tool",
          args: part.state?.title ? { path: part.state.title } : {},
          result: part.state?.output,
          status: toolStatus(part.state?.status),
        };
        state.upsertTool(part.sessionID, part.messageID, tool);
      }
      return;
    }
    case "message.part.delta": {
      if (event.properties.field && event.properties.field !== "text") return;
      state.appendDelta(event.properties.sessionID, event.properties.messageID, event.properties.delta);
      return;
    }
    case "permission.asked":
      state.upsertPermission(event.properties);
      return;
    case "permission.replied":
      state.removePermission(event.properties.requestID);
      return;
    case "question.asked":
      state.upsertQuestion(event.properties);
      return;
    case "question.replied":
    case "question.rejected":
      state.removeQuestion(event.properties.requestID);
      return;
    default:
      return;
  }
}
