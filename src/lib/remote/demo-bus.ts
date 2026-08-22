import { uid } from "@/lib/utils";
import type { HostEvent, PermissionReply } from "./events";

type Listener = (event: HostEvent) => void;

const listeners = new Set<Listener>();
const pendingPerm = new Map<string, (reply: PermissionReply) => void>();
const pendingQuestion = new Map<string, (answers: string[][] | "reject") => void>();
const timers = new Set<number>();

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      resolve();
    }, ms);
    timers.add(id);
  });
}

export function emitDemo(event: HostEvent) {
  for (const fn of listeners) fn(event);
}

export function subscribeDemo(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function resetDemoBus() {
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
  pendingPerm.clear();
  pendingQuestion.clear();
}

function emit(event: HostEvent) {
  emitDemo(event);
}

function waitPerm(id: string) {
  return new Promise<PermissionReply>((resolve) => pendingPerm.set(id, resolve));
}

function waitQuestion(id: string) {
  return new Promise<string[][] | "reject">((resolve) => pendingQuestion.set(id, resolve));
}

export function resolveDemoPermission(requestID: string, reply: PermissionReply) {
  const fn = pendingPerm.get(requestID);
  pendingPerm.delete(requestID);
  emit({ type: "permission.replied", properties: { sessionID: "", requestID, reply } });
  fn?.(reply);
}

export function resolveDemoQuestion(requestID: string, answers: string[][] | "reject") {
  const fn = pendingQuestion.get(requestID);
  pendingQuestion.delete(requestID);
  if (answers === "reject") {
    emit({ type: "question.rejected", properties: { sessionID: "", requestID } });
  } else {
    emit({ type: "question.replied", properties: { sessionID: "", requestID, answers } });
  }
  fn?.(answers);
}

async function streamText(sessionID: string, messageID: string, partID: string, text: string) {
  emit({
    type: "message.part.updated",
    properties: { part: { id: partID, sessionID, messageID, type: "text", text: "" } },
  });
  let acc = "";
  const chunks = text.match(/[\s\S]{1,12}/g) ?? [text];
  for (const chunk of chunks) {
    acc += chunk;
    emit({
      type: "message.part.delta",
      properties: { sessionID, messageID, partID, field: "text", delta: chunk },
    });
    await wait(28);
  }
  emit({
    type: "message.part.updated",
    properties: { part: { id: partID, sessionID, messageID, type: "text", text: acc } },
  });
}

/** Scripted live turn: tokens, permission, then a question — same bus as a real host. */
export async function demoPrompt(sessionID: string, text: string) {
  const asstID = uid("msg");
  const partText = uid("prt");
  const partTool = uid("prt");
  const permID = `per_${uid("p")}`;
  const queID = `que_${uid("q")}`;
  void text;

  emit({ type: "session.status", properties: { sessionID, status: { type: "busy" } } });
  emit({
    type: "message.updated",
    properties: { info: { id: asstID, sessionID, role: "assistant", time: { created: Date.now() } } },
  });

  await streamText(
    sessionID,
    asstID,
    partText,
    "收到。这是实时流，不是等一整轮才回。先读 logger，写入前会问你权限。",
  );

  emit({
    type: "message.part.updated",
    properties: {
      part: {
        id: partTool,
        sessionID,
        messageID: asstID,
        type: "tool",
        name: "read_file",
        tool: "read",
        state: { status: "running", title: "harbor/src/middleware/logger.ts" },
      },
    },
  });
  await wait(420);
  emit({
    type: "message.part.updated",
    properties: {
      part: {
        id: partTool,
        sessionID,
        messageID: asstID,
        type: "tool",
        name: "read_file",
        tool: "read",
        state: { status: "completed", title: "harbor/src/middleware/logger.ts", output: "8 行 · 已读取" },
      },
    },
  });

  emit({
    type: "permission.asked",
    properties: {
      id: permID,
      sessionID,
      permission: "edit",
      patterns: ["harbor/README.md"],
      always: ["harbor/README.md"],
      metadata: { description: "在 README 里加一句远程客户端怎么连。" },
      tool: { messageID: asstID, callID: partTool },
    },
  });

  const reply = await waitPerm(permID);
  emit({ type: "permission.replied", properties: { sessionID, requestID: permID, reply } });

  if (reply === "reject") {
    await streamText(sessionID, asstID, uid("prt"), "好，这次不改文件。你随时可以再发。");
    emit({ type: "session.status", properties: { sessionID, status: { type: "idle" } } });
    emit({ type: "session.idle", properties: { sessionID } });
    return;
  }

  emit({
    type: "message.part.updated",
    properties: {
      part: {
        id: uid("prt"),
        sessionID,
        messageID: asstID,
        type: "tool",
        name: "write_file",
        tool: "edit",
        state: { status: "completed", title: "harbor/README.md", output: "已写入 · +1" },
      },
    },
  });

  emit({
    type: "question.asked",
    properties: {
      id: queID,
      sessionID,
      questions: [
        {
          header: "测试",
          question: "README 已经改了。要不要顺手补一条路由测试？",
          options: [
            { label: "补测试", description: "给 harbor/tests 加一个断言" },
            { label: "先这样", description: "只保留 README 这一处" },
          ],
        },
      ],
    },
  });

  const answers = await waitQuestion(queID);
  emit(
    answers === "reject"
      ? { type: "question.rejected", properties: { sessionID, requestID: queID } }
      : { type: "question.replied", properties: { sessionID, requestID: queID, answers } },
  );

  const picked = answers === "reject" ? "" : answers[0]?.[0] ?? "";
  if (picked === "补测试") {
    await streamText(sessionID, asstID, uid("prt"), "测试文件也补上了。权限、提问、正文都是同一条事件流。");
  } else {
    await streamText(sessionID, asstID, uid("prt"), "先停在 README。提问和权限之后都会继续走这条流。");
  }
  emit({ type: "session.status", properties: { sessionID, status: { type: "idle" } } });
  emit({ type: "session.idle", properties: { sessionID } });
}
