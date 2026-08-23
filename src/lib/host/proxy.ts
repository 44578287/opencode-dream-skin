/** Transparent proxy to a real `opencode serve` process. */

const DEFAULT_UPSTREAM = "http://127.0.0.1:4096";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

export function opencodeUpstream() {
  return (process.env.OPENCODE_URL || DEFAULT_UPSTREAM).replace(/\/+$/, "");
}

export async function proxyOpencode(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      },
    });
  }

  const url = new URL(request.url);
  const idx = url.pathname.indexOf("/api/oc");
  const rest = (idx >= 0 ? url.pathname.slice(idx + "/api/oc".length) : url.pathname) || "/";
  const target = `${opencodeUpstream()}${rest.startsWith("/") ? rest : `/${rest}`}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenCode 未启动";
    return Response.json(
      { error: { message: `连不上 OpenCode（${opencodeUpstream()}）：${message}` } },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) out.set(key, value);
  });
  if (!out.has("Access-Control-Allow-Origin")) out.set("Access-Control-Allow-Origin", "*");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
