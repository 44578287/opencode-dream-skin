import type { Connection } from "./types";
import type { HostEvent, PermissionReply } from "./events";
import { readSse } from "./sse";
import { applyHostEvent } from "./apply-event";
import { notifyHostEvent } from "@/lib/notify";
import { authHeader, hostFetch } from "./http";
import { hostBase, splitModel } from "./types";

export type LiveHandle = { stop: () => void };

export function startLive(conn: Connection, onEvent?: (event: HostEvent) => void): LiveHandle {
  let stopped = false;
  let abort: AbortController | null = null;
  let retry = 0;
  const base = hostBase(conn);
  if (conn.kind === "offline" || !base) return { stop: () => undefined };

  const dispatch = (event: HostEvent) => {
    if (stopped) return;
    applyHostEvent(event);
    notifyHostEvent(event);
    onEvent?.(event);
  };

  const connect = async () => {
    while (!stopped) {
      abort = new AbortController();
      try {
        const res = await fetch(`${base}/event`, {
          headers: { ...authHeader(conn), Accept: "text/event-stream" },
          signal: abort.signal,
        });
        let body = res.ok ? res.body : null;
        if (!body) {
          const global = await fetch(`${base}/global/event`, {
            headers: { ...authHeader(conn), Accept: "text/event-stream" },
            signal: abort.signal,
          });
          if (!global.ok || !global.body) throw new Error(`事件流 ${res.status}`);
          body = global.body;
        }
        retry = 0;
        for await (const event of readSse(body)) dispatch(event);
      } catch (err) {
        if (stopped || (err instanceof DOMException && err.name === "AbortError")) return;
      }
      if (stopped) return;
      retry = Math.min(retry + 1, 6);
      await new Promise((r) => setTimeout(r, 800 * retry));
    }
  };

  void connect();
  return {
    stop: () => {
      stopped = true;
      abort?.abort();
    },
  };
}

export async function sendPrompt(
  conn: Connection,
  sessionID: string,
  text: string,
  opts?: { model?: string; agent?: "build" | "plan" },
) {
  if (conn.kind === "offline") throw new Error("未连接主机");
  const parsed = splitModel(opts?.model);
  const body = JSON.stringify({
    parts: [{ type: "text", text }],
    agent: opts?.agent,
    model: parsed,
  });
  const asyncRes = await hostFetch(conn, `/session/${encodeURIComponent(sessionID)}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (asyncRes.status === 204 || asyncRes.ok) return;
  const wait = await hostFetch(conn, `/session/${encodeURIComponent(sessionID)}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!wait.ok) throw new Error(`发送失败 ${wait.status}`);
}

export async function abortSession(conn: Connection, sessionID: string) {
  if (conn.kind === "offline") return;
  await hostFetch(conn, `/session/${encodeURIComponent(sessionID)}/abort`, { method: "POST" }).catch(() => undefined);
}

export async function replyPermission(conn: Connection, sessionID: string, requestID: string, reply: PermissionReply) {
  if (conn.kind === "offline") return;
  const headers = { "Content-Type": "application/json" };
  const res = await hostFetch(conn, `/session/${encodeURIComponent(sessionID)}/permissions/${encodeURIComponent(requestID)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ response: reply, reply }),
  });
  if (!res.ok) {
    await hostFetch(conn, `/permission/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ response: reply, reply }),
    }).catch(() => undefined);
  }
}

export async function replyQuestion(conn: Connection, requestID: string, answers: string[][]) {
  if (conn.kind === "offline") return;
  await hostFetch(conn, `/question/${encodeURIComponent(requestID)}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  }).catch(() => undefined);
}

export async function rejectQuestion(conn: Connection, requestID: string) {
  if (conn.kind === "offline") return;
  await hostFetch(conn, `/question/${encodeURIComponent(requestID)}/reject`, { method: "POST" }).catch(() => undefined);
}

export async function runShell(conn: Connection, sessionID: string, command: string) {
  if (conn.kind === "offline") throw new Error("未连接主机");
  const res = await hostFetch(conn, `/session/${encodeURIComponent(sessionID)}/shell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, agent: "build" }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`命令失败 ${res.status}`);
}
