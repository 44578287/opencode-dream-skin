#!/usr/bin/env node
/**
 * After `npm run build`, copy Nitro/Vercel static assets into `android-www/`
 * and write a Capacitor-friendly index.html that boots the client bundle.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRoot(cwd = process.cwd()) {
  return cwd;
}

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

export function renderIndexHtml({ indexJs, routesJs, stylesCss }) {
  const css = stylesCss
    ? `  <link rel="stylesheet" href="./assets/${stylesCss}" />\n`
    : "";
  const preload = routesJs
    ? `  <link rel="modulepreload" href="./assets/${routesJs}" />\n`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0d0d0e" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>OpenCode</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
${css}${preload}</head>
<body>
  <script type="module" src="./assets/${indexJs}"></script>
</body>
</html>
`;
}

export function prepareApkWww(root = process.cwd()) {
  const staticDir = findStaticDir(root);
  if (!staticDir) {
    throw new Error("No web build found. Run `npm run build` first.");
  }
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
  writeFileSync(join(out, "index.html"), renderIndexHtml(picked));
  return { out, staticDir, ...picked };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = prepareApkWww();
  console.log("[apk-www]", result.out);
  console.log("[apk-www] index", result.indexJs);
  console.log("[apk-www] styles", result.stylesCss);
}
