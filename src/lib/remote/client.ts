import { hostHealth, hostPull, hostPush } from "./server";
import type { Connection, HostHealth, SyncBundle } from "./types";

function authHeader(conn: Connection): Record<string, string> {
  if (!conn.password) return {};
  const token = btoa(`${conn.username || "opencode"}:${conn.password}`);
  return { Authorization: `Basic ${token}` };
}

function trimUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export async function probeConnection(conn: Connection): Promise<HostHealth> {
  if (conn.kind === "offline") {
    return { ok: false, kind: "offline", version: "", label: "未连接", error: "离线" };
  }
  if (conn.kind === "demo") {
    try {
      const res = await hostHealth();
      return { ok: true, kind: "demo", version: res.version, label: res.label };
    } catch (err) {
      return { ok: false, kind: "demo", version: "", label: "演示主机", error: err instanceof Error ? err.message : "演示主机不可用" };
    }
  }
  const base = trimUrl(conn.url);
  if (!base) return { ok: false, kind: "remote", version: "", label: "远程主机", error: "请填写主机地址" };
  try {
    const res = await fetch(`${base}/global/health`, { headers: { ...authHeader(conn) } });
    if (res.status === 401) {
      return { ok: false, kind: "remote", version: "", label: base, error: "需要用户名和密码" };
    }
    if (!res.ok) {
      return { ok: false, kind: "remote", version: "", label: base, error: `主机返回 ${res.status}` };
    }
    const body = (await res.json()) as { version?: string; healthy?: boolean };
    return { ok: true, kind: "remote", version: body.version ?? "opencode", label: base };
  } catch (err) {
    const message = err instanceof Error ? err.message : "无法连接";
    return {
      ok: false,
      kind: "remote",
      version: "",
      label: base,
      error: /failed|cors|network/i.test(message)
        ? "连不上主机。确认服务已开，并且允许这个页面的跨域。"
        : message,
    };
  }
}

export async function pullBundle(conn: Connection): Promise<SyncBundle> {
  if (conn.kind === "demo") return hostPull();
  if (conn.kind !== "remote") throw new Error("未连接");
  const base = trimUrl(conn.url);
  const headers = { ...authHeader(conn), Accept: "application/json" };
  const syncRes = await fetch(`${base}/dream-skin/sync`, { headers });
  if (syncRes.ok) return (await syncRes.json()) as SyncBundle;
  const sessions = await fetchRemoteSessions(base, headers);
  return {
    version: 1,
    updatedAt: Date.now(),
    themeId: "",
    appearance: "dark",
    customThemes: [],
    sessions,
    activeSessionId: sessions[0]?.id ?? "",
    files: {},
  };
}

export async function pushBundle(conn: Connection, bundle: SyncBundle): Promise<void> {
  if (conn.kind === "demo") {
    await hostPush({ data: bundle });
    return;
  }
  if (conn.kind !== "remote") return;
  const base = trimUrl(conn.url);
  const headers = { ...authHeader(conn), "Content-Type": "application/json" };
  const syncRes = await fetch(`${base}/dream-skin/sync`, { method: "PUT", headers, body: JSON.stringify(bundle) });
  if (syncRes.ok || syncRes.status === 404) {
    if (bundle.themeId) {
      await fetch(`${base}/config`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ theme: bundle.themeId }),
      }).catch(() => undefined);
    }
    return;
  }
  if (!syncRes.ok) throw new Error(`同步失败 ${syncRes.status}`);
}

async function fetchRemoteSessions(base: string, headers: Record<string, string>) {
  const res = await fetch(`${base}/session`, { headers });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{ id?: string; title?: string; time?: { updated?: number } }>;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    title: row.title || "远程会话",
    mode: "build" as const,
    model: "grok-4.5",
    status: "idle" as const,
    messages: [],
    updatedAt: row.time?.updated ?? Date.now(),
  })).filter((s) => s.id);
}
