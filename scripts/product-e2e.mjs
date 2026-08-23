#!/usr/bin/env node
/**
 * Full-product QA against the running app:
 * host HTTP (files/search/sessions) + browser (connect, editor, live Grok).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_URL || "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
mkdirSync(OUT, { recursive: true });

const result = {
  ok: true,
  steps: [],
};

function step(name, extra = {}) {
  const row = { name, ok: extra.ok !== false, ...extra };
  result.steps.push(row);
  if (row.ok === false) result.ok = false;
  console.log(JSON.stringify(row));
  return row.ok;
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}/api/oc${path}`, init);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

const health = await api("/global/health");
step("health", { ok: health.status === 200 && health.body?.healthy === true, status: health.status });

const listed = await api("/file?path=.");
step("list-root", {
  ok: Array.isArray(listed.body) && listed.body.some((n) => n.name === "README.md"),
  count: Array.isArray(listed.body) ? listed.body.length : 0,
});

const lib = await api("/file/content?path=src/lib.ts");
step("read-lib", { ok: lib.status === 200 && /function clamp/.test(lib.body?.content ?? "") });

const grep = await api("/find?pattern=titleCase");
step("search-titleCase", {
  ok: Array.isArray(grep.body) && grep.body.some((h) => (h.path || "").includes("lib.ts")),
  hits: Array.isArray(grep.body) ? grep.body.length : 0,
});

const notePath = `notes/e2e-${Date.now()}.md`;
const put = await api("/file/content", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: notePath, content: "# e2e note\nclamp is in src/lib.ts\n" }),
});
step("write-file", { ok: put.status === 200, path: notePath });

const status = await api("/file/status");
step("file-status", {
  ok: Array.isArray(status.body) && status.body.some((r) => r.path === notePath),
  rows: Array.isArray(status.body) ? status.body : status.body,
});

const created = await api("/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "e2e" }),
});
const sessionId = created.body?.id;
step("create-session", { ok: created.status === 200 && typeof sessionId === "string", sessionId });

let grokText = "";
if (sessionId && process.env.SKIP_GROK !== "1") {
  const prompt = await api(`/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent: "plan",
      parts: [{ type: "text", text: "只根据 src/lib.ts：clamp(15,0,10) 的返回值是多少？一句话回答，不要改文件。" }],
    }),
  });
  step("prompt-async", { ok: prompt.status === 204 || prompt.status === 200, status: prompt.status });

  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const msgs = await api(`/session/${sessionId}/message`);
    const list = Array.isArray(msgs.body) ? msgs.body : [];
    const asst = [...list].reverse().find((m) => (m.info?.role || m.role) === "assistant");
    const parts = asst?.parts ?? [];
    const text = parts
      .filter((p) => p.type === "text" || typeof p.text === "string")
      .map((p) => p.text ?? "")
      .join("");
    const done = Boolean(asst?.info?.time?.completed) || Boolean(asst?.completed);
    if (text.trim() && (done || /10/.test(text))) {
      grokText = text.trim();
      break;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  step("grok-plan-answer", {
    ok: /10/.test(grokText),
    preview: grokText.slice(0, 240),
  });
} else {
  step("grok-plan-answer", { ok: true, skipped: true });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate(() => localStorage.removeItem("opencode-desktop-v9"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const body = await page.locator("body").innerText();
  step("ui-connected", {
    ok: /本机 Grok 引擎|已接通|实时/.test(body) && !/先连上主机/.test(body),
    prefix: body.replace(/\s+/g, " ").slice(0, 180),
  });

  const fileBtn = page.getByRole("button", { name: "文件" }).first();
  if (await fileBtn.count()) await fileBtn.click();
  await page.waitForTimeout(400);
  const readme = page.getByText("README.md", { exact: true }).first();
  if (await readme.count()) await readme.click();
  await page.waitForTimeout(800);
  const editor = await page.locator("body").innerText();
  step("ui-open-readme", {
    ok: /工作区|OpenCode|规划/.test(editor),
  });
  await page.screenshot({ path: `${OUT}/e2e-desktop.png` });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await mobile.waitForTimeout(2500);
  const mbody = await mobile.locator("body").innerText();
  step("ui-mobile", {
    ok: /已连接|连接中|本机/.test(mbody) && !/先连上主机/.test(mbody),
    prefix: mbody.replace(/\s+/g, " ").slice(0, 160),
  });
  await mobile.screenshot({ path: `${OUT}/e2e-mobile.png` });
  await mobile.close();

  step("ui-no-pageerror", { ok: pageErrors.length === 0, pageErrors });
  await page.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/e2e-verdict.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
