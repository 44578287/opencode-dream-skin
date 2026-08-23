import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { hid } from "./ids.ts";
import {
  addMessage,
  appendText,
  askPermission,
  askQuestion,
  completeMessage,
  getSession,
  listMessages,
  patchSession,
  setText,
  upsertToolPart,
  type AgentKind,
} from "./state.ts";
import { publish } from "./events.ts";
import { allFilePaths, readRel, writeRel, WORK_DIR } from "./workspace.ts";

const execFileAsync = promisify(execFile);

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a workspace file by relative path.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List workspace file paths, optionally filtered.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a workspace file. Build mode only.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the workspace directory. Build mode only. Always request permission first.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user a multiple-choice question before continuing.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "options"],
      },
    },
  },
];

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

function toolsFor(mode: AgentKind) {
  if (mode === "plan") return TOOLS.filter((t) => t.function.name !== "write_file" && t.function.name !== "bash");
  return TOOLS;
}

function parseArgs(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw || "{}") as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      if (Array.isArray(val)) out[k] = val.map(String).join("\n");
      else out[k] = String(val ?? "");
    }
    return out;
  } catch {
    return {};
  }
}

async function streamRound(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  tools: typeof TOOLS,
  signal: AbortSignal,
  onText: (delta: string) => void,
): Promise<{ text: string; toolCalls: Array<{ id: string; name: string; args: string }> }> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1800,
      stream: true,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`模型调用失败（${res.status}）${body.slice(0, 180)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  const acc = new Map<number, { id: string; name: string; args: string }>();

  const consume = (block: string) => {
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json: {
        choices?: Array<{
          delta?: {
            content?: string;
            tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = json.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        text += delta.content;
        onText(delta.content);
      }
      for (const call of delta.tool_calls ?? []) {
        const idx = call.index ?? 0;
        const prev = acc.get(idx) ?? { id: "", name: "", args: "" };
        if (call.id) prev.id = call.id;
        if (call.function?.name) prev.name += call.function.name;
        if (call.function?.arguments) prev.args += call.function.arguments;
        acc.set(idx, prev);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) consume(part);
  }
  if (buf.trim()) consume(buf);

  const toolCalls = [...acc.values()].filter((c) => c.name);
  for (const c of toolCalls) if (!c.id) c.id = hid("call");
  return { text, toolCalls };
}

async function executeBash(command: string, signal: AbortSignal): Promise<{ result: string; status: "ok" | "error" }> {
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
      cwd: WORK_DIR,
      timeout: 20000,
      maxBuffer: 800_000,
      signal,
    });
    const out = `${stdout}${stderr}`.trim();
    return { result: out.slice(0, 8000) || "(no output)", status: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "命令失败";
    return { result: msg.slice(0, 4000), status: "error" };
  }
}

async function runTool(
  sessionID: string,
  mode: AgentKind,
  name: string,
  args: Record<string, string>,
  signal: AbortSignal,
): Promise<{ result: string; status: "ok" | "error" }> {
  if (signal.aborted) return { result: "已中止", status: "error" };

  if (name === "list_files") {
    const q = (args.query ?? "").toLowerCase();
    const paths = allFilePaths().filter((p) => !q || p.toLowerCase().includes(q));
    return { result: paths.join("\n") || "(empty)", status: "ok" };
  }

  if (name === "read_file") {
    try {
      const content = readRel(args.path ?? "");
      return { result: content.slice(0, 12000), status: "ok" };
    } catch (err) {
      return { result: err instanceof Error ? err.message : "读取失败", status: "error" };
    }
  }

  if (name === "write_file") {
    if (mode === "plan") return { result: "规划模式不能写文件。", status: "error" };
    const path = args.path ?? "";
    if (!path) return { result: "缺少 path", status: "error" };
    const reply = await askPermission(sessionID, "edit", [path], { description: `写入 ${path}` });
    if (reply === "reject") return { result: "用户拒绝了写入。", status: "error" };
    writeRel(path, args.content ?? "");
    return { result: `已写入 ${path}（${(args.content ?? "").split("\n").length} 行）`, status: "ok" };
  }

  if (name === "bash") {
    if (mode === "plan") return { result: "规划模式不能执行命令。", status: "error" };
    const command = args.command ?? "";
    if (!command) return { result: "缺少 command", status: "error" };
    const reply = await askPermission(sessionID, "bash", [command], { description: command });
    if (reply === "reject") return { result: "用户拒绝了这条命令。", status: "error" };
    return executeBash(command, signal);
  }

  if (name === "ask_user") {
    const question = args.question || "请选择";
    const options = (args.options ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const opts = options.length ? options : ["继续", "先这样"];
    const answers = await askQuestion({
      id: hid("que"),
      sessionID,
      questions: [
        {
          question,
          options: opts.map((label) => ({ label })),
        },
      ],
    });
    if (answers === "reject") return { result: "用户跳过了这个问题。", status: "ok" };
    return { result: `用户选择：${answers[0]?.[0] ?? ""}`, status: "ok" };
  }

  return { result: `未知工具 ${name}`, status: "error" };
}

export async function runShellCommand(sessionID: string, command: string) {
  const session = getSession(sessionID);
  if (!session) throw new Error("会话不存在");
  session.abort?.abort();
  const abort = new AbortController();
  session.abort = abort;

  addMessage(sessionID, "user", `$ ${command}`);
  const asst = addMessage(sessionID, "assistant", "");
  patchSession(sessionID, { status: "busy" });

  const partID = hid("prt");
  upsertToolPart(sessionID, asst.id, partID, "bash", { status: "running", title: command });

  const reply = await askPermission(sessionID, "bash", [command], { description: command });
  if (abort.signal.aborted || reply === "reject") {
    upsertToolPart(sessionID, asst.id, partID, "bash", {
      status: "error",
      title: command,
      output: abort.signal.aborted ? "已中止" : "用户拒绝了这条命令。",
    });
    setText(sessionID, asst.id, abort.signal.aborted ? "已停止。" : "未执行。");
    completeMessage(sessionID, asst.id);
    patchSession(sessionID, { status: "idle" });
    return;
  }

  const { result, status } = await executeBash(command, abort.signal);
  upsertToolPart(sessionID, asst.id, partID, "bash", {
    status: status === "ok" ? "completed" : "error",
    title: command,
    output: result,
  });
  setText(sessionID, asst.id, status === "ok" ? "" : result);
  completeMessage(sessionID, asst.id);
  patchSession(sessionID, { status: "idle" });
}

export async function runPrompt(sessionID: string, text: string, modelID?: string, agent?: AgentKind) {
  const session = getSession(sessionID);
  if (!session) throw new Error("会话不存在");
  const mode = agent ?? session.agent;
  const model = (modelID || session.modelID || "grok-4.5").replace(/^xai\//, "");
  session.modelID = model;
  session.agent = mode;
  session.abort?.abort();
  const abort = new AbortController();
  session.abort = abort;

  addMessage(sessionID, "user", text);
  const asst = addMessage(sessionID, "assistant", "");
  patchSession(sessionID, { status: "busy" });

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    setText(sessionID, asst.id, "当前环境没有接入模型密钥，无法调用 Grok。主题和工作区仍然可用。");
    completeMessage(sessionID, asst.id);
    patchSession(sessionID, { status: "error" });
    publish({
      type: "session.error",
      properties: { sessionID, error: { message: "未配置模型密钥" } },
    });
    return;
  }

  const files = allFilePaths();
  const history = listMessages(sessionID)
    .filter((m) => m.id !== asst.id)
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: m.parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n"),
    }));

  const messages: ChatMsg[] = [
    {
      role: "system",
      content: [
        "You are OpenCode, a production coding agent.",
        `Workspace root is on disk. Relative paths only. Files:\n${files.map((p) => `- ${p}`).join("\n")}`,
        mode === "plan"
          ? "PLAN MODE: read-only. Propose a concrete plan. Do not write files or run shell."
          : "BUILD MODE: you may write files and run shell after the user grants permission.",
        "Reply in the user's language. Be concise. Prefer tools over inventing file contents.",
        "Do not dump entire files into the chat unless asked.",
      ].join("\n"),
    },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    for (let round = 0; round < 6; round++) {
      if (abort.signal.aborted) break;
      const { text: roundText, toolCalls } = await streamRound(
        apiKey,
        model.startsWith("grok-") ? model : "grok-4.5",
        messages,
        toolsFor(mode),
        abort.signal,
        (delta) => appendText(sessionID, asst.id, delta),
      );

      if (!toolCalls.length) {
        if (!roundText.trim()) {
          const existing = listMessages(sessionID).find((m) => m.id === asst.id);
          const has = existing?.parts.some((p) => p.text?.trim());
          if (!has) setText(sessionID, asst.id, "这一轮没有产生输出。换个说法再问一次。");
        }
        break;
      }

      messages.push({
        role: "assistant",
        content: roundText || "",
        tool_calls: toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.args },
        })),
      });

      for (const call of toolCalls) {
        if (abort.signal.aborted) break;
        const args = parseArgs(call.args);
        const partID = hid("prt");
        upsertToolPart(sessionID, asst.id, partID, call.name, {
          status: "running",
          title: args.path || args.command || call.name,
        });
        const { result, status } = await runTool(sessionID, mode, call.name, args, abort.signal);
        upsertToolPart(sessionID, asst.id, partID, call.name, {
          status: status === "ok" ? "completed" : "error",
          title: args.path || args.command || call.name,
          output: result,
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }
  } catch (err) {
    if (abort.signal.aborted) {
      setText(sessionID, asst.id, "已停止。");
    } else {
      const message = err instanceof Error ? err.message : "模型请求中断";
      appendText(sessionID, asst.id, `\n\n${message}`);
      publish({ type: "session.error", properties: { sessionID, error: { message } } });
      completeMessage(sessionID, asst.id);
      patchSession(sessionID, { status: "error" });
      return;
    }
  }

  completeMessage(sessionID, asst.id);
  patchSession(sessionID, { status: "idle" });
}
