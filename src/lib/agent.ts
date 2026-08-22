import { createServerFn } from "@tanstack/react-start";
import type { VFile } from "./workspace";

export type AgentFile = { path: string; content: string };

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; args: Record<string, string>; result: string; status: "ok" | "error" };

export type AgentRequest = {
  prompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  files: AgentFile[];
  mode: "build" | "plan";
  model: string;
};

export type AgentResponse =
  | { ok: true; events: AgentEvent[]; files: AgentFile[] }
  | { ok: false; error: string };

const TOOLS_BUILD = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the workspace by path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List workspace file paths, optionally filtered by substring.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a workspace file. Only in build mode.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
];

const TOOLS_PLAN = TOOLS_BUILD.filter((t) => t.function.name !== "write_file");

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export const runAgentTurn = createServerFn({ method: "POST" })
  .validator((input: AgentRequest) => input)
  .handler(async ({ data }): Promise<AgentResponse> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "当前环境没有接入模型。主题和市场主题仍然可用。" };
    }

    const files = new Map(data.files.map((f) => [f.path, f.content]));
    const events: AgentEvent[] = [];
    const tools = data.mode === "plan" ? TOOLS_PLAN : TOOLS_BUILD;
    const model = data.model.startsWith("grok-") ? data.model : "grok-4.5";

    const messages: ChatMsg[] = [
      {
        role: "system",
        content: [
          "You are OpenCode, an AI coding agent inside a desktop workbench.",
          "Workspace is a virtual TypeScript project named harbor.",
          data.mode === "plan"
            ? "PLAN MODE: read-only. Propose a plan. Do not write files."
            : "BUILD MODE: you may write files. Keep diffs small and explain what changed.",
          "Reply in the user's language. Be concise. Use tools instead of inventing file contents.",
          "Files:\n" + [...files.keys()].map((p) => `- ${p}`).join("\n"),
        ].join("\n"),
      },
      ...data.history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.prompt },
    ];

    try {
      for (let round = 0; round < 4; round++) {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            tools,
            tool_choice: "auto",
            temperature: 0.4,
            max_tokens: 1400,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          return { ok: false, error: `模型调用失败（${res.status}）` + (body ? "" : "") };
        }
        const json = (await res.json()) as {
          choices: Array<{
            message: ChatMsg;
            finish_reason?: string;
          }>;
        };
        const message = json.choices[0]?.message;
        if (!message) return { ok: false, error: "模型没有返回内容。" };

        const calls = message.tool_calls ?? [];
        if (calls.length === 0) {
          const text = (message.content ?? "").trim();
          if (text) events.push({ type: "text", text });
          break;
        }

        messages.push({
          role: "assistant",
          content: message.content ?? "",
          tool_calls: calls,
        });

        for (const call of calls) {
          const name = call.function.name;
          let args: Record<string, string> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, string>;
          } catch {
            args = {};
          }
          const { result, status } = execTool(name, args, files, data.mode);
          events.push({ type: "tool", id: call.id, name, args, result, status });
          messages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
      }
    } catch {
      return { ok: false, error: "模型请求中断，请再试一次。" };
    }

    if (events.length === 0) {
      events.push({ type: "text", text: "这一轮没有产生输出。换个说法再问一次。" });
    }

    return {
      ok: true,
      events,
      files: [...files.entries()].map(([path, content]) => ({ path, content })),
    };
  });

function execTool(
  name: string,
  args: Record<string, string>,
  files: Map<string, string>,
  mode: "build" | "plan",
): { result: string; status: "ok" | "error" } {
  if (name === "list_files") {
    const q = (args.query ?? "").toLowerCase();
    const paths = [...files.keys()].filter((p) => !q || p.toLowerCase().includes(q));
    return { result: paths.join("\n") || "(empty)", status: "ok" };
  }
  if (name === "read_file") {
    const path = args.path;
    const content = files.get(path);
    if (content == null) return { result: `文件不存在：${path}`, status: "error" };
    return { result: content.slice(0, 8000), status: "ok" };
  }
  if (name === "write_file") {
    if (mode === "plan") return { result: "规划模式不能写文件。", status: "error" };
    const path = args.path;
    const content = args.content ?? "";
    if (!path) return { result: "缺少 path", status: "error" };
    files.set(path, content);
    return { result: `已写入 ${path}（${content.split("\n").length} 行）`, status: "ok" };
  }
  return { result: `未知工具 ${name}`, status: "error" };
}

export function filesToAgent(files: Record<string, VFile>): AgentFile[] {
  return Object.values(files).map((f) => ({ path: f.path, content: f.content }));
}
