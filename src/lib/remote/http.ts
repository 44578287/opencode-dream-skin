import type { Connection } from "./types";
import { hostBase } from "./types";

export class HostError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export function authHeader(conn: Connection): Record<string, string> {
  if (conn.kind === "local" || !conn.password) return {};
  const token = btoa(`${conn.username || "opencode"}:${conn.password}`);
  return { Authorization: `Basic ${token}` };
}

export async function hostFetch(
  conn: Connection,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = hostBase(conn);
  if (!base) throw new HostError("未连接主机");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeader(conn),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  return res;
}

export async function hostJson<T>(conn: Connection, path: string, init: RequestInit = {}): Promise<T> {
  const res = await hostFetch(conn, path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    let msg = `主机返回 ${res.status}`;
    if (body && typeof body === "object" && body !== null && "error" in body) {
      const err = (body as { error: unknown }).error;
      if (typeof err === "string" && err) msg = err;
      else if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: string }).message;
        if (m) msg = m;
      }
    }
    throw new HostError(msg, res.status);
  }
  return body as T;
}
