import type { Connection, FileNode, HostHealth, HostModel, SearchHit } from "./types";
import { hostBase, modelKey } from "./types";
import { HostError, hostFetch, hostJson } from "./http";
import type { ChatMessage, Session, ToolCall } from "@/lib/store";

export async function probeConnection(conn: Connection): Promise<HostHealth> {
  if (conn.kind === "offline") {
    return { ok: false, kind: "offline", version: "", label: "未连接", error: "未连接" };
  }
  const base = hostBase(conn);
  if (!base) return { ok: false, kind: conn.kind, version: "", label: "主机", error: "请填写主机地址" };
  try {
    const res = await hostFetch(conn, "/global/health");
    if (res.status === 401) {
      return { ok: false, kind: conn.kind, version: "", label: labelOf(conn), error: "需要用户名和密码" };
    }
    if (!res.ok) {
      return { ok: false, kind: conn.kind, version: "", label: labelOf(conn), error: `主机返回 ${res.status}` };
    }
    const body = (await res.json()) as { version?: string; healthy?: boolean };
    return {
      ok: true,
      kind: conn.kind,
      version: body.version ?? "opencode",
      label: labelOf(conn),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "无法连接";
    return {
      ok: false,
      kind: conn.kind,
      version: "",
      label: labelOf(conn),
      error: /failed|cors|network|fetch/i.test(message)
        ? "连不上主机。确认 OpenCode 已启动，并且加了这个页面的 --cors。"
        : message,
    };
  }
}

function labelOf(conn: Connection) {
  if (conn.kind === "local") return "本机 OpenCode";
  return conn.url.trim().replace(/\/+$/, "") || "OpenCode 主机";
}

type RawSession = {
  id?: string;
  title?: string;
  time?: { updated?: number; created?: number };
};

export function mapSession(row: RawSession, extra?: Partial<Session>): Session {
  return {
    id: String(row.id ?? ""),
    title: row.title || "会话",
    mode: extra?.mode ?? "build",
    model: extra?.model ?? "",
    status: extra?.status ?? "idle",
    messages: extra?.messages ?? [],
    updatedAt: row.time?.updated ?? row.time?.created ?? Date.now(),
  };
}

export async function listRemoteSessions(conn: Connection): Promise<Session[]> {
  const rows = await hostJson<RawSession[]>(conn, "/session");
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => mapSession(row)).filter((s) => s.id);
}

export async function createRemoteSession(conn: Connection, title?: string): Promise<Session> {
  const row = await hostJson<RawSession>(conn, "/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title || "新会话" }),
  });
  return mapSession(row);
}

export async function deleteRemoteSession(conn: Connection, id: string) {
  await hostFetch(conn, `/session/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function renameRemoteSession(conn: Connection, id: string, title: string) {
  await hostJson(conn, `/session/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

type RawPart = {
  id?: string;
  type?: string;
  text?: string;
  name?: string;
  tool?: string;
  state?: { status?: string; title?: string; output?: string };
};

type RawMessage = {
  info?: { id?: string; sessionID?: string; role?: string; time?: { created?: number; completed?: number } };
  parts?: RawPart[];
  id?: string;
  role?: string;
};

export function mapMessages(rows: RawMessage[]): ChatMessage[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const parts = row.parts ?? [];
    const text = parts
      .filter((p) => p.type === "text" || typeof p.text === "string")
      .map((p) => p.text ?? "")
      .join("");
    const tools: ToolCall[] = parts
      .filter((p) => p.type === "tool" || p.tool || p.name)
      .map((p) => ({
        id: String(p.id ?? ""),
        name: p.name || p.tool || "tool",
        args: p.state?.title ? { path: p.state.title } : ({} as Record<string, string>),
        result: p.state?.output,
        status: p.state?.status === "error" || p.state?.status === "failed" ? "error" : p.state?.status === "completed" || p.state?.status === "ok" ? "ok" : "running",
      }));
    const infoObj = (row.info ?? {
      id: row.id,
      role: row.role,
    }) as {
      id?: string;
      role?: string;
      time?: { created?: number; completed?: number };
      error?: { message?: string; data?: { message?: string } };
    };
    const role = (infoObj.role === "user" ? "user" : "assistant") as ChatMessage["role"];
    const errText = infoObj.error?.data?.message || infoObj.error?.message || "";
    return {
      id: String(infoObj.id ?? ""),
      role,
      content: text || errText,
      tools: tools.length ? tools : undefined,
      streaming: role === "assistant" && !infoObj.time?.completed,
      createdAt: infoObj.time?.created ?? Date.now(),
    };
  });
}

export async function listRemoteMessages(conn: Connection, sessionID: string): Promise<ChatMessage[]> {
  const rows = await hostJson<RawMessage[]>(conn, `/session/${encodeURIComponent(sessionID)}/message`);
  return mapMessages(rows);
}

export async function fetchProviders(conn: Connection): Promise<HostModel[]> {
  try {
    const body = await hostJson<{
      providers?: Array<{
        id?: string;
        name?: string;
        models?: Array<{ id?: string; name?: string }> | Record<string, { id?: string; name?: string } | string>;
      }>;
      all?: Array<{
        id?: string;
        name?: string;
        models?: Array<{ id?: string; name?: string }> | Record<string, { id?: string; name?: string } | string>;
      }>;
    }>(conn, "/config/providers");
    const list = body.providers ?? body.all ?? [];
    const models: HostModel[] = [];
    for (const p of list) {
      const provider = p.id || p.name || "provider";
      for (const m of normalizeModels(p.models)) {
        if (!m.id) continue;
        if (/imagine|video|image/i.test(m.id)) continue;
        models.push({
          id: modelKey(provider, m.id),
          label: m.name || m.id,
          provider,
        });
      }
    }
    models.sort((a, b) => scoreModel(a) - scoreModel(b) || a.label.localeCompare(b.label));
    return models;
  } catch {
    return [];
  }
}

function normalizeModels(
  raw: Array<{ id?: string; name?: string }> | Record<string, { id?: string; name?: string } | string> | undefined,
): Array<{ id: string; name: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((m) => m.id).map((m) => ({ id: m.id!, name: m.name || m.id! }));
  }
  return Object.entries(raw).map(([id, m]) => {
    if (m && typeof m === "object") return { id: m.id || id, name: m.name || id };
    return { id, name: id };
  });
}

function scoreModel(m: HostModel) {
  if (/xai\/grok-4\.5$/i.test(m.id) || /\/grok-4\.5$/i.test(m.id)) return 0;
  if (m.provider === "xai" && /grok-4/i.test(m.id)) return 1;
  if (m.provider === "xai") return 2;
  if (/\/.*free$/i.test(m.id) || /big-pickle/i.test(m.id)) return 6;
  return 8;
}

export async function fetchDefaultModel(conn: Connection): Promise<string | null> {
  try {
    const cfg = await hostJson<{ model?: string }>(conn, "/config");
    return typeof cfg?.model === "string" && cfg.model ? cfg.model : null;
  } catch {
    return null;
  }
}

export async function fetchProject(conn: Connection): Promise<{ name: string; path: string; branch: string }> {
  let name = "workspace";
  let path = "";
  let branch = "main";
  try {
    const cur = await hostJson<{ name?: string; worktree?: string; directory?: string }>(conn, "/project/current");
    if (cur?.name) name = cur.name;
    if (cur?.worktree) {
      path = cur.worktree;
      if (!cur.name) name = path.split("/").filter(Boolean).pop() || name;
    }
  } catch {
    try {
      const p = await hostJson<{ directory?: string; worktree?: string }>(conn, "/path");
      path = p.worktree || p.directory || "";
    } catch {
      /* ignore */
    }
  }
  try {
    const vcs = await hostJson<{ branch?: string }>(conn, "/vcs");
    if (vcs?.branch) branch = vcs.branch;
  } catch {
    /* ignore */
  }
  return { name, path, branch };
}

export async function listFileNodes(conn: Connection, path = "."): Promise<FileNode[]> {
  try {
    const rows = await hostJson<Array<{ name?: string; path?: string; type?: string }>>(
      conn,
      `/file?path=${encodeURIComponent(path)}`,
    );
    if (Array.isArray(rows)) {
      return rows
        .map((r) => ({
          name: r.name || (r.path ?? "").split("/").filter(Boolean).pop() || "",
          path: (r.path || "").replace(/\/+$/, ""),
          type: r.type === "directory" || r.type === "dir" ? ("directory" as const) : ("file" as const),
          ignored: Boolean((r as { ignored?: boolean }).ignored),
        }))
        .filter((r) => (r.path || r.name) && r.name !== ".git" && r.name !== "node_modules" && !r.ignored);
    }
  } catch {
    /* fallback */
  }
  try {
    const names = await hostJson<string[]>(conn, `/find/file?query=&limit=200`);
    if (Array.isArray(names)) {
      return names.filter((p) => typeof p === "string").map((p) => ({ name: p.split("/").pop() || p, path: p, type: "file" as const }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function readRemoteFile(conn: Connection, path: string): Promise<string> {
  const body = await hostJson<unknown>(conn, `/file/content?path=${encodeURIComponent(path)}`);
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const o = body as { content?: string; text?: string };
    if (typeof o.content === "string") return o.content;
    if (typeof o.text === "string") return o.text;
  }
  return "";
}

export async function writeRemoteFile(conn: Connection, path: string, content: string) {
  const res = await hostFetch(conn, `/file/content?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.includes("text/html")) {
    throw new HostError("这台 OpenCode 没有独立的保存接口。切到构建模式，让助手改文件。", res.status || 404);
  }
  return true;
}

export async function deleteRemoteFile(conn: Connection, path: string) {
  const res = await hostFetch(conn, `/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new HostError(`删除失败 ${res.status}`, res.status);
  return res.ok;
}

export async function searchRemote(conn: Connection, pattern: string): Promise<SearchHit[]> {
  const rows = await hostJson<Array<{ path?: string; line_number?: number; line?: number; lines?: string; text?: string }>>(
    conn,
    `/find?pattern=${encodeURIComponent(pattern)}`,
  );
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    path: r.path || "",
    line: r.line_number ?? r.line ?? 0,
    text: r.lines ?? r.text ?? "",
  }));
}

export async function fileStatus(conn: Connection): Promise<{ path: string; status: string }[]> {
  const rows = await hostJson<Array<{ path?: string; status?: string }>>(conn, "/file/status");
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({ path: r.path || "", status: r.status || "modified" })).filter((r) => r.path);
}

export async function fetchRemoteTheme(conn: Connection): Promise<string | null> {
  try {
    const cfg = await hostJson<{ theme?: string }>(conn, "/config");
    return cfg?.theme || null;
  } catch {
    return null;
  }
}

export async function pushRemoteTheme(conn: Connection, theme: string) {
  await hostJson(conn, "/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme }),
  }).catch(() => undefined);
}
