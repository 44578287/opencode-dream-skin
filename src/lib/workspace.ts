export type VFile = {
  path: string;
  content: string;
  original: string;
};

export const PROJECT_ROOT = "harbor";

const seed: Record<string, string> = {
  "harbor/README.md": `# Harbor

A tiny TypeScript HTTP router. Used as the OpenCode desktop workspace.

## Scripts

- \`npm test\` — run unit tests
- \`npm run dev\` — start the sample server
`,
  "harbor/package.json": `{
  "name": "harbor",
  "version": "0.3.1",
  "type": "module",
  "scripts": {
    "dev": "node --experimental-strip-types src/index.ts",
    "test": "node --test tests/router.test.ts"
  }
}
`,
  "harbor/src/index.ts": `import { createServer } from "node:http";
import { Router } from "./router.ts";
import { logger } from "./middleware/logger.ts";
import { health } from "./handler.ts";

const router = new Router();
router.use(logger);
router.get("/health", health);
router.get("/v1/ping", () => ({ ok: true, ts: Date.now() }));

const port = Number(process.env.PORT ?? 8787);
createServer((req, res) => router.handle(req, res)).listen(port);
console.log(\`harbor listening on :\${port}\`);
`,
  "harbor/src/router.ts": `import type { IncomingMessage, ServerResponse } from "node:http";
import type { Handler, Middleware } from "./types.ts";

type Route = { method: string; path: string; handler: Handler };

export class Router {
  private routes: Route[] = [];
  private stack: Middleware[] = [];

  use(mw: Middleware) {
    this.stack.push(mw);
    return this;
  }

  get(path: string, handler: Handler) {
    this.routes.push({ method: "GET", path, handler });
    return this;
  }

  async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://harbor.local");
    const route = this.routes.find((r) => r.method === req.method && r.path === url.pathname);
    if (!route) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    let i = 0;
    const next = async (): Promise<void> => {
      const mw = this.stack[i++];
      if (mw) return mw(req, res, next);
      const body = await route.handler(req);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    await next();
  }
}
`,
  "harbor/src/handler.ts": `import type { IncomingMessage } from "node:http";

export function health(_req: IncomingMessage) {
  return {
    ok: true,
    service: "harbor",
    uptime: process.uptime(),
  };
}
`,
  "harbor/src/types.ts": `import type { IncomingMessage, ServerResponse } from "node:http";

export type Handler = (req: IncomingMessage) => Promise<unknown> | unknown;
export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>,
) => Promise<void> | void;
`,
  "harbor/src/middleware/logger.ts": `import type { Middleware } from "../types.ts";

export const logger: Middleware = async (req, _res, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(\`\${req.method} \${req.url} \${ms}ms\`);
};
`,
  "harbor/tests/router.test.ts": `import { test } from "node:test";
import assert from "node:assert/strict";
import { Router } from "../src/router.ts";

test("registers GET routes", () => {
  const router = new Router();
  router.get("/health", () => ({ ok: true }));
  assert.equal(typeof router.handle, "function");
});
`,
};

export function seedFiles(): Record<string, VFile> {
  const out: Record<string, VFile> = {};
  for (const [path, content] of Object.entries(seed)) {
    out[path] = { path, content, original: content };
  }
  return out;
}

export function languageOf(path: string) {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "ts";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "md";
  if (path.endsWith(".css")) return "css";
  return "text";
}

export function treeFromFiles(files: Record<string, VFile>) {
  type Node = { name: string; path: string; kind: "file" | "dir"; children?: Node[] };
  const root: Node = { name: PROJECT_ROOT, path: PROJECT_ROOT, kind: "dir", children: [] };

  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split("/");
    let node = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      if (i === 0 && part === root.name) continue;
      const isFile = i === parts.length - 1;
      node.children ??= [];
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: acc,
          kind: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
        };
        node.children.push(child);
      }
      node = child;
    }
  }
  return root;
}

export function changedFiles(files: Record<string, VFile>) {
  return Object.values(files).filter((f) => f.content !== f.original);
}
