import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pickAssets, prepareApkWww, renderIndexHtml } from "./prepare-apk-www.mjs";

describe("prepare-apk-www", () => {
  it("picks hashed client assets", () => {
    const picked = pickAssets(["index-abc.js", "routes-xyz.js", "styles-q.css", "other.txt"]);
    assert.equal(picked.indexJs, "index-abc.js");
    assert.equal(picked.routesJs, "routes-xyz.js");
    assert.equal(picked.stylesCss, "styles-q.css");
  });

  it("renders a module-loading shell", () => {
    const html = renderIndexHtml({
      indexJs: "index-abc.js",
      routesJs: "routes-xyz.js",
      stylesCss: "styles-q.css",
    });
    assert.match(html, /assets\/index-abc\.js/);
    assert.match(html, /assets\/styles-q\.css/);
    assert.match(html, /modulepreload/);
  });

  it("copies a vercel static build into android-www", () => {
    const root = mkdtempSync(join(tmpdir(), "apk-www-"));
    try {
      const assets = join(root, ".vercel/output/static/assets");
      mkdirSync(assets, { recursive: true });
      writeFileSync(join(assets, "index-TEST.js"), "console.log(1)");
      writeFileSync(join(assets, "styles-TEST.css"), "body{}");
      writeFileSync(join(root, ".vercel/output/static/favicon.svg"), "<svg></svg>");
      mkdirSync(join(root, "public"), { recursive: true });
      writeFileSync(join(root, "public/sw.js"), "/* sw */");

      const result = prepareApkWww(root);
      const html = readFileSync(join(result.out, "index.html"), "utf8");
      assert.equal(result.indexJs, "index-TEST.js");
      assert.match(html, /index-TEST\.js/);
      assert.match(readFileSync(join(result.out, "sw.js"), "utf8"), /sw/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
