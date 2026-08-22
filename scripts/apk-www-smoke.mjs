#!/usr/bin/env node
/**
 * Load android-www the way the APK WebView does: static files + baked SSR HTML.
 * Empty body or a hydrateRoot crash fails the job — that is the black screen.
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(process.cwd(), "android-www");
if (!existsSync(join(root, "index.html"))) {
  console.error("[apk-smoke] android-www/index.html missing — run prepare-apk-www first");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function serve(dir) {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = join(dir, pathname);
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolveServer({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const outDir = existsSync("/workspace")
  ? "/workspace/screenshots"
  : join(process.cwd(), "screenshots");
mkdirSync(outDir, { recursive: true });

const { server, url } = await serve(root);
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const pageErrors = [];
const consoleErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);
  const sceneCount = await page.locator(".desktop-scene").count();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const title = await page.title();
  const png = join(outDir, "apk-www.png");
  await page.screenshot({ path: png, fullPage: false });

  const result = {
    url,
    status: resp?.status() ?? 0,
    title,
    sceneCount,
    bodyTextLen: bodyText.replace(/\s+/g, " ").trim().length,
    bodyTextPrefix: bodyText.replace(/\s+/g, " ").trim().slice(0, 180),
    pageErrors,
    consoleErrors: consoleErrors.slice(0, 12),
    screenshot: png,
  };
  console.log(JSON.stringify(result, null, 2));

  const fatal = [];
  if (result.status !== 200) fatal.push(`HTTP ${result.status}`);
  if (sceneCount < 1) fatal.push("missing .desktop-scene");
  if (result.bodyTextLen < 40) fatal.push("body text too short — black screen");
  if (pageErrors.length) fatal.push(`pageerror: ${pageErrors.join(" | ")}`);
  if (fatal.length) {
    console.error("[apk-smoke] FAIL", fatal);
    process.exitCode = 1;
  } else {
    console.log("[apk-smoke] ok");
  }
} finally {
  await browser.close();
  server.close();
}
