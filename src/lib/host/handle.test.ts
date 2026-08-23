import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { handleOpencode } from "./handle.ts";
import { resetHostState } from "./state.ts";
import { resetWorkspace, dropFileCache } from "./workspace.ts";

async function call(path: string, init: RequestInit = {}) {
  const req = new Request(`http://localhost/api/oc${path}`, init);
  return handleOpencode(req);
}

describe("opencode-compatible host", () => {
  beforeEach(() => {
    resetWorkspace();
    resetHostState();
  });

  it("reports health", async () => {
    const res = await call("/global/health");
    assert.equal(res.status, 200);
    const body = (await res.json()) as { healthy: boolean; version: string };
    assert.equal(body.healthy, true);
    assert.ok(body.version);
  });

  it("creates and lists sessions", async () => {
    const created = await call("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "测试会话" }),
    });
    assert.equal(created.status, 200);
    const row = (await created.json()) as { id: string; title: string };
    assert.ok(row.id.startsWith("ses_"));
    assert.equal(row.title, "测试会话");

    const listed = await call("/session");
    const sessions = (await listed.json()) as Array<{ id: string }>;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.id, row.id);
  });

  it("serves workspace files", async () => {
    const listed = await call("/file?path=.");
    const nodes = (await listed.json()) as Array<{ name: string; type: string }>;
    assert.ok(nodes.some((n) => n.name === "README.md"));
    assert.ok(nodes.some((n) => n.name === "src" && n.type === "directory"));

    const file = await call("/file/content?path=src/lib.ts");
    const body = (await file.json()) as { content: string };
    assert.match(body.content, /export function clamp/);

    const found = await call("/find/file?query=lib");
    const paths = (await found.json()) as string[];
    assert.ok(paths.some((p) => p.includes("lib.ts")));
  });

  it("writes a file and shows status", async () => {
    const put = await call("/file/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "README.md", content: "# changed\n" }),
    });
    assert.equal(put.status, 200);
    const status = await call("/file/status");
    const rows = (await status.json()) as Array<{ path: string; status: string }>;
    assert.ok(rows.some((r) => r.path === "README.md"));
  });

  it("creates, greps, and deletes a file", async () => {
    const put = await call("/file/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "notes/todo.md", content: "remember clamp later\n" }),
    });
    assert.equal(put.status, 200);

    const status = await call("/file/status");
    const st = (await status.json()) as Array<{ path: string }>;
    assert.ok(st.some((r) => r.path === "notes/todo.md"));

    const hits = await call("/find?pattern=clamp");
    const rows = (await hits.json()) as Array<{ path: string; lines: string }>;
    assert.ok(rows.some((r) => r.path === "notes/todo.md" || r.path === "src/lib.ts"));

    const del = await call("/file?path=notes/todo.md", { method: "DELETE" });
    assert.equal(del.status, 200);
    const missing = await call("/file/content?path=notes/todo.md");
    assert.equal(missing.status, 404);
  });

  it("rejects empty prompts and empty shell", async () => {
    const created = await call("/session", { method: "POST", body: "{}" });
    const row = (await created.json()) as { id: string };
    const res = await call(`/session/${row.id}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: [{ type: "text", text: "   " }] }),
    });
    assert.equal(res.status, 400);

    const shell = await call(`/session/${row.id}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "  " }),
    });
    assert.equal(shell.status, 400);
  });

  it("accepts a shell command asynchronously", async () => {
    const created = await call("/session", { method: "POST", body: "{}" });
    const row = (await created.json()) as { id: string };
    const shell = await call(`/session/${row.id}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "pwd" }),
    });
    assert.equal(shell.status, 204);
  });

  it("exposes providers", async () => {
    const res = await call("/config/providers");
    const body = (await res.json()) as { providers: Array<{ id: string }> };
    assert.equal(body.providers[0]?.id, "xai");
  });

  it("does not wipe an existing workspace on ensure", async () => {
    await call("/file/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "keep.txt", content: "persist-me" }),
    });
    dropFileCache();
    const file = await call("/file/content?path=keep.txt");
    const body = (await file.json()) as { content: string };
    assert.equal(body.content, "persist-me");
  });
});
