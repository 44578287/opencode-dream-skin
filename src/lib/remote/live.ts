import type { Connection } from "./types";
import type { HostEvent, PermissionReply } from "./events";
import { readSse } from "./sse";
import { applyHostEvent } from "./apply-event";
import { demoPrompt, resolveDemoPermission, resolveDemoQuestion, subscribeDemo, resetDemoBus } from "./demo-bus";
import { notifyHostEvent } from "@/lib/notify";

function authHeader(conn: Connection): Record<string, string> {
  if (!conn.password) return {};
  const token = btoa(`${conn.username || "opencode"}:${conn.password}`);
  return { Authorization: `Basic ${token}` };
}

function trimUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export type LiveHandle = { stop: () => void };

/** Open a long-lived OpenCode event stream. Demo uses the in-process bus. */
export function startLive(conn: Connection, onEvent?: (event: HostEvent) => void): LiveHandle {
  let stopped = false;
  let abort: AbortController | null = null;
  let unsub: (() => void) | null = null;
  let retry = 0;

  const dispatch = (event: HostEvent) => {
    if (stopped) return;
    applyHostEvent(event);
    notifyHostEvent(event);
    onEvent?.(event);
  };

  if (conn.kind === "offline") return { stop: () => undefined };

  if (conn.kind === "demo") {
    unsub = subscribeDemo(dispatch);
    dispatch({ type: "server.connected" });
    return {
      stop: () => {
        stopped = true;
        unsub?.();
      },
    };
  }

  const base = trimUrl(conn.url);
  if (!base) return { stop: () => undefined };

  const connect = async () => {
    while (!stopped) {
      abort = new AbortController();
      try {
        const res = await fetch(`${base}/event`, {
          headers: { ...authHeader(conn), Accept: "text/event-stream" },
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          const global = await fetch(`${base}/global/event`, {
            headers: { ...authHeader(conn), Accept: "text/event-stream" },
            signal: abort.signal,
          });
          if (!global.ok || !global.body) throw new Error(`事件流 ${res.status}`);
          retry = 0;
          for await (const event of readSse(global.body)) dispatch(event);
        } else {
          retry = 0;
          for await (const event of readSse(res.body)) dispatch(event);
        }
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

export async function sendPrompt(conn: Connection, sessionID: string, text: string) {
  if (conn.kind === "demo") {
    void demoPrompt(sessionID, text);
    return;
  }
  if (conn.kind !== "remote") throw new Error("未连接");
  const base = trimUrl(conn.url);
  const headers = { ...authHeader(conn), "Content-Type": "application/json" };
  const body = JSON.stringify({ parts: [{ type: "text", text }] });
  const asyncRes = await fetch(`${base}/session/${encodeURIComponent(sessionID)}/prompt_async`, {
    method: "POST",
    headers,
    body,
  });
  if (asyncRes.status === 204 || asyncRes.ok) return;
  const wait = await fetch(`${base}/session/${encodeURIComponent(sessionID)}/message`, {
    method: "POST",
    headers,
    body,
  });
  if (!wait.ok) throw new Error(`发送失败 ${wait.status}`);
}

export async function abortSession(conn: Connection, sessionID: string) {
  if (conn.kind === "demo") {
    resetDemoBus();
    applyHostEvent({ type: "session.idle", properties: { sessionID } });
    return;
  }
  if (conn.kind !== "remote") return;
  const base = trimUrl(conn.url);
  await fetch(`${base}/session/${encodeURIComponent(sessionID)}/abort`, {
    method: "POST",
    headers: authHeader(conn),
  }).catch(() => undefined);
}

export async function replyPermission(conn: Connection, sessionID: string, requestID: string, reply: PermissionReply) {
  if (conn.kind === "demo") {
    resolveDemoPermission(requestID, reply);
    return;
  }
  if (conn.kind !== "remote") return;
  const base = trimUrl(conn.url);
  const headers = { ...authHeader(conn), "Content-Type": "application/json" };
  const res = await fetch(
    `${base}/session/${encodeURIComponent(sessionID)}/permissions/${encodeURIComponent(requestID)}`,
    { method: "POST", headers, body: JSON.stringify({ reply }) },
  );
  if (!res.ok) {
    await fetch(`${base}/permission/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reply }),
    }).catch(() => undefined);
  }
}

export async function replyQuestion(conn: Connection, requestID: string, answers: string[][]) {
  if (conn.kind === "demo") {
    resolveDemoQuestion(requestID, answers);
    return;
  }
  if (conn.kind !== "remote") return;
  const base = trimUrl(conn.url);
  const headers = { ...authHeader(conn), "Content-Type": "application/json" };
  const res = await fetch(`${base}/question/${encodeURIComponent(requestID)}/reply`, {
    method: "POST",
    headers,
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    await fetch(`${base}/session/question/${encodeURIComponent(requestID)}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ answers }),
    }).catch(() => undefined);
  }
}

export async function rejectQuestion(conn: Connection, requestID: string) {
  if (conn.kind === "demo") {
    resolveDemoQuestion(requestID, "reject");
    return;
  }
  if (conn.kind !== "remote") return;
  const base = trimUrl(conn.url);
  await fetch(`${base}/question/${encodeURIComponent(requestID)}/reject`, {
    method: "POST",
    headers: authHeader(conn),
  }).catch(() => undefined);
}
