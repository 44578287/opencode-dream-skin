#!/usr/bin/env node
/**
 * After `npm run build`, copy Nitro/Vercel static assets into `android-www/`
 * and drop in the SSR HTML from `vite preview`. A bare script tag without
 * `$_TSR` hydrates into a black screen — that path is not allowed.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function findStaticDir(root) {
  const candidates = [
    join(root, ".vercel/output/static"),
    join(root, ".output/public"),
    join(root, "dist"),
  ];
  return candidates.find((dir) => existsSync(dir)) ?? null;
}

export function pickAssets(names) {
  return {
    indexJs: names.find((f) => /^index-.*\.js$/.test(f)) ?? null,
    routesJs: names.find((f) => /^routes-.*\.js$/.test(f)) ?? null,
    stylesCss: names.find((f) => /^styles-.*\.css$/.test(f)) ?? null,
  };
}

export function assertHydratableHtml(html) {
  if (!html || typeof html !== "string") throw new Error("SSR HTML is empty");
  if (!html.includes("$_TSR")) {
    throw new Error("SSR HTML is missing $_TSR — APK would black-screen on hydrate");
  }
  if (!html.includes("desktop-scene") && !html.includes("data-ds-part")) {
    throw new Error("SSR HTML is missing the app shell");
  }
  return html;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { previewUrl: null, htmlPath: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from-preview") out.previewUrl = argv[++i];
    else if (arg === "--html") out.htmlPath = argv[++i];
    else if (arg.startsWith("--from-preview=")) out.previewUrl = arg.slice("--from-preview=".length);
    else if (arg.startsWith("--html=")) out.htmlPath = arg.slice("--html=".length);
  }
  return out;
}

export async function loadSsrHtml({ html, htmlPath, previewUrl, root = process.cwd() }) {
  if (html) return assertHydratableHtml(html);
  if (htmlPath) {
    const path = resolve(root, htmlPath);
    if (!existsSync(path)) throw new Error(`SSR HTML not found: ${path}`);
    return assertHydratableHtml(readFileSync(path, "utf8"));
  }
  if (previewUrl) {
    const res = await fetch(previewUrl);
    if (!res.ok) throw new Error(`Preview ${previewUrl} returned ${res.status}`);
    return assertHydratableHtml(await res.text());
  }
  throw new Error("Pass --from-preview URL or --html path (a client-only shell black-screens).");
}

export async function prepareApkWww(root = process.cwd(), options = {}) {
  const staticDir = findStaticDir(root);
  if (!staticDir) {
    throw new Error("No web build found. Run `npm run build` first.");
  }
  const html = await loadSsrHtml({ ...options, root });
  const out = join(root, "android-www");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(staticDir, out, { recursive: true });

  const swSrc = join(root, "public/sw.js");
  if (existsSync(swSrc)) cpSync(swSrc, join(out, "sw.js"));

  const assetsDir = join(out, "assets");
  const names = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const picked = pickAssets(names);
  if (!picked.indexJs) {
    throw new Error(`Missing client index bundle in ${assetsDir}`);
  }
  writeFileSync(join(out, "index.html"), html);
  return { out, staticDir, htmlBytes: html.length, ...picked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = parseArgs();
  const result = await prepareApkWww(process.cwd(), args);
  console.log("[apk-www]", result.out);
  console.log("[apk-www] html bytes", result.htmlBytes);
  console.log("[apk-www] index", result.indexJs);
}
