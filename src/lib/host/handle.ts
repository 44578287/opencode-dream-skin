import { subscribe } from "./events.ts";
import {
  abortSession,
  createSession,
  deleteSession,
  getSession,
  getThemeId,
  listMessages,
  listSessions,
  patchSession,
  publicMessage,
  publicSession,
  rejectQuestion,
  replyPermission,
  replyQuestion,
  resetHostState,
  setThemeId,
} from "./state.ts";
import {
  allFilePaths,
  findFiles,
  grep,
  listRel,
  pathMeta,
  projectMeta,
  readRel,
  snapshotFiles,
  statusFiles,
  unlinkRel,
  writeRel,
  ensureWorkspace,
} from "./workspace.ts";
import { runPrompt, runShellCommand } from "./agent.ts";
import type { PermissionReply } from "../remote/events.ts";
import { PROJECT_NAME } from "./seed.ts";

const VERSION = "1.0.0";

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Credentials", "false");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function json(data: unknown, status = 200) {
  return cors(Response.json(data, { status }));
}

function noContent() {
  return cors(new Response(null, { status: 204 }));
}

function notFound(msg = "not found") {
  return json({ error: { message: msg } }, 404);
}

function bad(msg: string) {
  return json({ error: { message: msg } }, 400);
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function match(path: string, pattern: string): Record<string, string> | null {
  const a = path.split("/").filter(Boolean);
  const b = pattern.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < b.length; i++) {
    if (b[i]!.startsWith(":")) params[b[i]!.slice(1)] = decodeURIComponent(a[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function sseResponse(req: Request) {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send({ type: "server.connected", properties: {} });
      unsub = subscribe((event) => send(event));
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
      req.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unsub?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsub?.();
    },
  });
  return cors(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }),
  );
}

function providers() {
  return {
    providers: [
      {
        id: "xai",
        name: "xAI",
        models: [{ id: "grok-4.5", name: "Grok 4.5", tags: ["default"] }],
      },
    ],
    default: { xai: "grok-4.5" },
  };
}

export async function handleOpencode(request: Request): Promise<Response> {
  ensureWorkspace();
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const idx = url.pathname.indexOf("/api/oc");
  const splat = (idx >= 0 ? url.pathname.slice(idx + "/api/oc".length) : url.pathname).replace(/^\/+/, "");
  const path = `/${splat}`;

  if (method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    if ((path === "/event" || path === "/global/event") && method === "GET") return sseResponse(request);

    if (path === "/global/health" && method === "GET") {
      return json({ healthy: true, version: VERSION });
    }

    if (path === "/session" && method === "GET") {
      return json(listSessions().map(publicSession));
    }

    if (path === "/session" && method === "POST") {
      const body = await readBody(request);
      const row = createSession({
        title: typeof body.title === "string" ? body.title : undefined,
      });
      return json(publicSession(row));
    }

    if (path === "/session/status" && method === "GET") {
      const out: Record<string, { type: string }> = {};
      for (const s of listSessions()) out[s.id] = { type: s.status };
      return json(out);
    }

    {
      const p = match(path, "/session/:id");
      if (p && method === "GET") {
        const row = getSession(p.id);
        return row ? json(publicSession(row)) : notFound("session");
      }
      if (p && method === "DELETE") {
        return deleteSession(p.id) ? json(true) : notFound("session");
      }
      if (p && method === "PATCH") {
        const body = await readBody(request);
        const row = patchSession(p.id, { title: typeof body.title === "string" ? body.title : undefined });
        return row ? json(publicSession(row)) : notFound("session");
      }
    }

    {
      const p = match(path, "/session/:id/abort");
      if (p && method === "POST") return abortSession(p.id) ? json(true) : notFound("session");
    }

    {
      const p = match(path, "/session/:id/message");
      if (p && method === "GET") {
        if (!getSession(p.id)) return notFound("session");
        return json(listMessages(p.id).map(publicMessage));
      }
      if (p && method === "POST") {
        const body = await readBody(request);
        return startPrompt(p.id, body);
      }
    }

    {
      const p = match(path, "/session/:id/prompt_async");
      if (p && method === "POST") {
        const body = await readBody(request);
        return startPrompt(p.id, body, true);
      }
    }

    {
      const p = match(path, "/session/:id/shell");
      if (p && method === "POST") {
        const body = await readBody(request);
        const command = String(body.command ?? "");
        if (!command.trim()) return bad("缺少 command");
        if (!getSession(p.id)) return notFound("session");
        void runShellCommand(p.id, command).catch((err) => {
          console.error("[host] shell failed", err);
        });
        return noContent();
      }
    }

    {
      const p = match(path, "/session/:id/permissions/:permissionID");
      if (p && method === "POST") {
        const body = await readBody(request);
        const reply = (body.response ?? body.reply) as PermissionReply;
        if (reply !== "once" && reply !== "always" && reply !== "reject") return bad("无效的权限回复");
        return replyPermission(p.permissionID, reply) ? json(true) : notFound("permission");
      }
    }

    {
      const p = match(path, "/permission/:id/reply");
      if (p && method === "POST") {
        const body = await readBody(request);
        const reply = (body.response ?? body.reply) as PermissionReply;
        return replyPermission(p.id, reply) ? json(true) : notFound("permission");
      }
    }

    {
      const p = match(path, "/question/:id/reply");
      if (p && method === "POST") {
        const body = await readBody(request);
        const answers = Array.isArray(body.answers) ? (body.answers as string[][]) : [];
        return replyQuestion(p.id, answers) ? json(true) : notFound("question");
      }
    }
    {
      const p = match(path, "/question/:id/reject");
      if (p && method === "POST") return rejectQuestion(p.id) ? json(true) : notFound("question");
    }

    if (path === "/file" && method === "GET") {
      return json(listRel(url.searchParams.get("path") || "."));
    }
    if (path === "/file" && method === "DELETE") {
      const filePath = url.searchParams.get("path") || "";
      if (!filePath) return bad("缺少 path");
      try {
        return unlinkRel(filePath) ? json({ ok: true, path: filePath }) : notFound("file");
      } catch (err) {
        return bad(err instanceof Error ? err.message : "删除失败");
      }
    }
    if (path === "/file/content" && method === "GET") {
      const filePath = url.searchParams.get("path") || "";
      try {
        return json({ type: "text", content: readRel(filePath) });
      } catch (err) {
        return notFound(err instanceof Error ? err.message : "file");
      }
    }
    if (path === "/file/content" && (method === "PUT" || method === "POST")) {
      const body = await readBody(request);
      const filePath = String(body.path ?? url.searchParams.get("path") ?? "");
      if (!filePath) return bad("缺少 path");
      writeRel(filePath, String(body.content ?? ""));
      return json({ ok: true, path: filePath });
    }
    if (path === "/file/status" && method === "GET") {
      return json(statusFiles().map((f) => ({ path: f.path, status: f.status })));
    }

    if (path === "/find" && method === "GET") {
      const pattern = url.searchParams.get("pattern") || "";
      if (!pattern) return json([]);
      return json(grep(pattern));
    }
    if (path === "/find/file" && method === "GET") {
      const query = url.searchParams.get("query") ?? "";
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 80) || 80));
      return json(findFiles(query, limit));
    }

    if (path === "/config" && method === "GET") {
      return json({ theme: getThemeId(), model: "xai/grok-4.5", username: "opencode" });
    }
    if (path === "/config" && method === "PATCH") {
      const body = await readBody(request);
      if (typeof body.theme === "string") setThemeId(body.theme);
      return json({ theme: getThemeId(), model: "xai/grok-4.5", username: "opencode" });
    }
    if (path === "/config/providers" && method === "GET") return json(providers());
    if (path === "/provider" && method === "GET") {
      const p = providers();
      return json({ all: p.providers, default: p.default, connected: ["xai"] });
    }

    if (path === "/path" && method === "GET") return json(pathMeta());
    if (path === "/project" && method === "GET") return json([projectMeta()]);
    if (path === "/project/current" && method === "GET") return json(projectMeta());
    if (path === "/vcs" && method === "GET") return json({ branch: "main" });
    if (path === "/agent" && method === "GET") {
      return json([
        { id: "build", name: "构建", mode: "primary" },
        { id: "plan", name: "规划", mode: "primary" },
      ]);
    }

    if (path === "/dream-skin/sync" && method === "GET") {
      const sess = listSessions();
      return json({
        version: 1,
        updatedAt: Date.now(),
        themeId: getThemeId(),
        appearance: "dark",
        customThemes: [],
        sessions: sess.map((s) => ({
          id: s.id,
          title: s.title,
          mode: s.agent,
          model: s.modelID,
          status: s.status === "busy" ? "running" : s.status === "error" ? "error" : "idle",
          messages: listMessages(s.id).map((m) => ({
            id: m.id,
            role: m.role,
            content: m.parts.filter((p) => p.type === "text").map((x) => x.text ?? "").join("\n"),
            createdAt: m.created,
          })),
          updatedAt: s.updated,
        })),
        activeSessionId: sess[0]?.id ?? "",
        files: snapshotFiles(),
      });
    }
    if (path === "/dream-skin/sync" && method === "PUT") {
      const body = await readBody(request);
      if (typeof body.themeId === "string") setThemeId(body.themeId);
      return json({ ok: true });
    }

    if (path === "/doc" && method === "GET") {
      return json({
        openapi: "3.1.0",
        info: { title: "OpenCode compatible host", version: VERSION },
        servers: [{ url: "/api/oc" }],
      });
    }

    if (path === "/__reset" && method === "POST") {
      resetHostState();
      return json({ ok: true, files: allFilePaths().length, project: PROJECT_NAME });
    }

    return notFound(path);
  } catch (err) {
    return json({ error: { message: err instanceof Error ? err.message : "internal error" } }, 500);
  }
}

function extractText(body: Record<string, unknown>) {
  const parts = body.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((p) => {
        if (p && typeof p === "object" && (p as { type?: string }).type === "text") {
          return String((p as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (typeof body.text === "string") return body.text.trim();
  if (typeof body.prompt === "string") return body.prompt.trim();
  return "";
}

function extractModel(body: Record<string, unknown>) {
  const model = body.model;
  if (typeof model === "string") return model.replace(/^xai\//, "");
  if (model && typeof model === "object") {
    const id = (model as { modelID?: string }).modelID;
    if (typeof id === "string") return id;
  }
  return undefined;
}

function extractAgent(body: Record<string, unknown>): "build" | "plan" | undefined {
  const agent = body.agent;
  if (agent === "plan" || agent === "build") return agent;
  return undefined;
}

async function startPrompt(sessionID: string, body: Record<string, unknown>, async = false) {
  const session = getSession(sessionID);
  if (!session) return notFound("session");
  const text = extractText(body);
  if (!text) return bad("缺少正文");
  const modelID = extractModel(body);
  const agent = extractAgent(body);
  if (modelID) patchSession(sessionID, { modelID });
  if (agent) patchSession(sessionID, { agent });

  if (async) {
    void runPrompt(sessionID, text, modelID, agent).catch((err) => {
      console.error("[host] prompt failed", err);
    });
    return noContent();
  }
  await runPrompt(sessionID, text, modelID, agent);
  const msgs = listMessages(sessionID);
  const last = msgs.at(-1);
  return last ? json(publicMessage(last)) : json({ ok: true });
}
