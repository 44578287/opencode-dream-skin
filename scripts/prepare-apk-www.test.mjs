import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertHydratableHtml,
  parseArgs,
  pickAssets,
  prepareApkWww,
} from "./prepare-apk-www.mjs";

const SSR = `<!DOCTYPE html><html><body><div class="desktop-scene" data-ds-part="root">OpenCode</div><script>self.$_TSR={}</script></body></html>`;

describe("prepare-apk-www", () => {
  it("picks hashed client assets", () => {
    const picked = pickAssets(["index-abc.js", "routes-xyz.js", "styles-q.css", "other.txt"]);
    assert.equal(picked.indexJs, "index-abc.js");
    assert.equal(picked.routesJs, "routes-xyz.js");
    assert.equal(picked.stylesCss, "styles-q.css");
  });

  it("rejects a client-only shell", () => {
    assert.throws(() => assertHydratableHtml("<html><body><script src='./assets/index.js'></script></body></html>"));
  });

  it("parses CLI flags", () => {
    assert.equal(parseArgs(["--from-preview", "http://127.0.0.1:8081/"]).previewUrl, "http://127.0.0.1:8081/");
    assert.equal(parseArgs(["--html", "ssr.html"]).htmlPath, "ssr.html");
  });

  it("copies a vercel static build and writes SSR html", async () => {
    const root = mkdtempSync(join(tmpdir(), "apk-www-"));
    try {
      const assets = join(root, ".vercel/output/static/assets");
      mkdirSync(assets, { recursive: true });
      writeFileSync(join(assets, "index-TEST.js"), "console.log(1)");
      writeFileSync(join(root, ".vercel/output/static/favicon.svg"), "<svg></svg>");
      mkdirSync(join(root, "public"), { recursive: true });
      writeFileSync(join(root, "public/sw.js"), "/* sw */");
      writeFileSync(join(root, "ssr.html"), SSR);

      const result = await prepareApkWww(root, { htmlPath: "ssr.html" });
      const html = readFileSync(join(result.out, "index.html"), "utf8");
      assert.equal(result.indexJs, "index-TEST.js");
      assert.match(html, /\$_TSR/);
      assert.match(html, /desktop-scene/);
      assert.match(readFileSync(join(result.out, "sw.js"), "utf8"), /sw/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
