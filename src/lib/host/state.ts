import { hid } from "./ids.ts";
import { publish } from "./events.ts";
import type { HostEvent, PermissionReply, QuestionRequest } from "../remote/events.ts";
import { ensureWorkspace } from "./workspace.ts";

export type AgentKind = "build" | "plan";

export type SessionRow = {
  id: string;
  title: string;
  agent: AgentKind;
  providerID: string;
  modelID: string;
  status: "idle" | "busy" | "error";
  created: number;
  updated: number;
  abort?: AbortController;
  remember: Set<string>;
};

export type Part = {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text" | "tool";
  text?: string;
  name?: string;
  tool?: string;
  state?: { status?: string; title?: string; output?: string };
};

export type MessageRow = {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  created: number;
  completed?: number;
  parts: Part[];
};

export type PendingPerm = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  resolve: (reply: PermissionReply) => void;
  timer?: ReturnType<typeof setTimeout>;
};

export type PendingQuestion = {
  request: QuestionRequest;
  resolve: (answers: string[][] | "reject") => void;
  timer?: ReturnType<typeof setTimeout>;
};

const PERMISSION_TIMEOUT_MS = 120_000;

const sessions = new Map<string, SessionRow>();
const messages = new Map<string, MessageRow[]>();
const pendingPerm = new Map<string, PendingPerm>();
const pendingQuestion = new Map<string, PendingQuestion>();
let themeId = "preset-gothic-void-crusade";

export function resetHostState() {
  for (const s of sessions.values()) s.abort?.abort();
  for (const p of pendingPerm.values()) {
    clearTimeout(p.timer);
    p.resolve("reject");
  }
  for (const q of pendingQuestion.values()) {
    clearTimeout(q.timer);
    q.resolve("reject");
  }
  sessions.clear();
  messages.clear();
  pendingPerm.clear();
  pendingQuestion.clear();
  ensureWorkspace();
}

export function listSessions(): SessionRow[] {
  return [...sessions.values()].sort((a, b) => b.updated - a.updated);
}

export function getSession(id: string) {
  return sessions.get(id) ?? null;
}

export function publicSession(s: SessionRow) {
  return {
    id: s.id,
    title: s.title,
    time: { created: s.created, updated: s.updated },
  };
}

export function createSession(input?: { title?: string; agent?: AgentKind; modelID?: string }) {
  const now = Date.now();
  const row: SessionRow = {
    id: hid("ses"),
    title: input?.title?.trim() || "新会话",
    agent: input?.agent ?? "build",
    providerID: "xai",
    modelID: input?.modelID ?? "grok-4.5",
    status: "idle",
    created: now,
    updated: now,
    remember: new Set(),
  };
  sessions.set(row.id, row);
  messages.set(row.id, []);
  publish({ type: "session.updated", properties: { info: publicSession(row) } });
  return row;
}

export function patchSession(id: string, patch: Partial<Pick<SessionRow, "title" | "agent" | "modelID" | "status">>) {
  const row = sessions.get(id);
  if (!row) return null;
  Object.assign(row, patch);
  row.updated = Date.now();
  if (patch.status === "busy") {
    publish({ type: "session.status", properties: { sessionID: id, status: { type: "busy" } } });
  } else if (patch.status === "idle") {
    publish({ type: "session.status", properties: { sessionID: id, status: { type: "idle" } } });
    publish({ type: "session.idle", properties: { sessionID: id } });
  } else if (patch.status === "error") {
    publish({ type: "session.status", properties: { sessionID: id, status: { type: "error" } } });
  }
  publish({ type: "session.updated", properties: { info: publicSession(row) } });
  return row;
}

export function deleteSession(id: string) {
  const row = sessions.get(id);
  if (!row) return false;
  row.abort?.abort();
  rejectPendingForSession(id);
  sessions.delete(id);
  messages.delete(id);
  publish({ type: "session.deleted", properties: { info: { id } } });
  return true;
}

export function abortSession(id: string) {
  const row = sessions.get(id);
  if (!row) return false;
  row.abort?.abort();
  row.abort = new AbortController();
  rejectPendingForSession(id);
  patchSession(id, { status: "idle" });
  return true;
}

function rejectPendingForSession(sessionID: string) {
  for (const [id, p] of pendingPerm) {
    if (p.sessionID !== sessionID) continue;
    clearTimeout(p.timer);
    pendingPerm.delete(id);
    p.resolve("reject");
  }
  for (const [id, q] of pendingQuestion) {
    if (q.request.sessionID !== sessionID) continue;
    clearTimeout(q.timer);
    pendingQuestion.delete(id);
    q.resolve("reject");
  }
}

export function listMessages(id: string) {
  return messages.get(id) ?? [];
}

export function publicMessage(m: MessageRow) {
  return {
    info: {
      id: m.id,
      sessionID: m.sessionID,
      role: m.role,
      time: { created: m.created, completed: m.completed },
    },
    parts: m.parts,
  };
}

export function addMessage(sessionID: string, role: "user" | "assistant", text = "") {
  const row = sessions.get(sessionID);
  if (!row) throw new Error("会话不存在");
  const msg: MessageRow = {
    id: hid("msg"),
    sessionID,
    role,
    created: Date.now(),
    parts: text
      ? [
          {
            id: hid("prt"),
            sessionID,
            messageID: "",
            type: "text",
            text,
          },
        ]
      : [],
  };
  for (const p of msg.parts) p.messageID = msg.id;
  const list = messages.get(sessionID) ?? [];
  list.push(msg);
  messages.set(sessionID, list);
  row.updated = Date.now();
  if (role === "user" && row.title === "新会话" && text.trim()) {
    row.title = text.trim().slice(0, 36);
  }
  publish({
    type: "message.updated",
    properties: { info: { id: msg.id, sessionID, role, time: { created: msg.created } } },
  });
  if (text) {
    publish({
      type: "message.part.updated",
      properties: { part: msg.parts[0]! },
    });
  }
  return msg;
}

export function appendText(sessionID: string, messageID: string, delta: string) {
  const list = messages.get(sessionID) ?? [];
  const msg = list.find((m) => m.id === messageID);
  if (!msg) return;
  let part = msg.parts.find((p) => p.type === "text");
  if (!part) {
    part = { id: hid("prt"), sessionID, messageID, type: "text", text: "" };
    msg.parts.push(part);
  }
  part.text = `${part.text ?? ""}${delta}`;
  publish({
    type: "message.part.delta",
    properties: { sessionID, messageID, partID: part.id, field: "text", delta },
  });
}

export function setText(sessionID: string, messageID: string, text: string) {
  const list = messages.get(sessionID) ?? [];
  const msg = list.find((m) => m.id === messageID);
  if (!msg) return;
  let part = msg.parts.find((p) => p.type === "text");
  if (!part) {
    part = { id: hid("prt"), sessionID, messageID, type: "text", text };
    msg.parts.push(part);
  } else {
    part.text = text;
  }
  publish({ type: "message.part.updated", properties: { part } });
}

export function upsertToolPart(
  sessionID: string,
  messageID: string,
  partID: string,
  name: string,
  state: Part["state"],
) {
  const list = messages.get(sessionID) ?? [];
  const msg = list.find((m) => m.id === messageID);
  if (!msg) return;
  let part = msg.parts.find((p) => p.id === partID);
  if (!part) {
    part = { id: partID, sessionID, messageID, type: "tool", name, tool: name, state };
    msg.parts.push(part);
  } else {
    part.name = name;
    part.tool = name;
    part.state = state;
  }
  publish({ type: "message.part.updated", properties: { part } });
}

export function completeMessage(sessionID: string, messageID: string) {
  const list = messages.get(sessionID) ?? [];
  const msg = list.find((m) => m.id === messageID);
  if (!msg) return;
  msg.completed = Date.now();
  publish({
    type: "message.updated",
    properties: {
      info: { id: msg.id, sessionID, role: msg.role, time: { created: msg.created, completed: msg.completed } },
    },
  });
}

export function askPermission(sessionID: string, permission: string, patterns: string[], metadata?: Record<string, unknown>) {
  const row = sessions.get(sessionID);
  const key = `${permission}:${patterns[0] ?? "*"}`;
  if (row?.remember.has(permission) || row?.remember.has(key)) {
    return Promise.resolve("always" as PermissionReply);
  }
  const id = hid("per");
  publish({
    type: "permission.asked",
    properties: { id, sessionID, permission, patterns, always: [permission], metadata },
  });
  return new Promise<PermissionReply>((resolve) => {
    const timer = setTimeout(() => {
      if (!pendingPerm.has(id)) return;
      pendingPerm.delete(id);
      publish({ type: "permission.replied", properties: { sessionID, requestID: id, reply: "reject" } });
      resolve("reject");
    }, PERMISSION_TIMEOUT_MS);
    pendingPerm.set(id, { id, sessionID, permission, patterns, resolve, timer });
  });
}

export function replyPermission(id: string, reply: PermissionReply) {
  const pending = pendingPerm.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingPerm.delete(id);
  if (reply === "always") {
    sessions.get(pending.sessionID)?.remember.add(pending.permission);
  }
  publish({ type: "permission.replied", properties: { sessionID: pending.sessionID, requestID: id, reply } });
  pending.resolve(reply);
  return true;
}

export function askQuestion(request: QuestionRequest) {
  publish({ type: "question.asked", properties: request });
  return new Promise<string[][] | "reject">((resolve) => {
    const timer = setTimeout(() => {
      if (!pendingQuestion.has(request.id)) return;
      pendingQuestion.delete(request.id);
      publish({ type: "question.rejected", properties: { sessionID: request.sessionID, requestID: request.id } });
      resolve("reject");
    }, PERMISSION_TIMEOUT_MS);
    pendingQuestion.set(request.id, { request, resolve, timer });
  });
}

export function replyQuestion(id: string, answers: string[][]) {
  const pending = pendingQuestion.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingQuestion.delete(id);
  publish({ type: "question.replied", properties: { sessionID: pending.request.sessionID, requestID: id, answers } });
  pending.resolve(answers);
  return true;
}

export function rejectQuestion(id: string) {
  const pending = pendingQuestion.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingQuestion.delete(id);
  publish({ type: "question.rejected", properties: { sessionID: pending.request.sessionID, requestID: id } });
  pending.resolve("reject");
  return true;
}

export function getThemeId() {
  return themeId;
}

export function setThemeId(id: string) {
  if (id) themeId = id;
  return themeId;
}

export function emit(event: HostEvent) {
  publish(event);
}

ensureWorkspace();
