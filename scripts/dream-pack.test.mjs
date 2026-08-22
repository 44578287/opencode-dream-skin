import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const { unzipBytes } = await import(pathToFileURL("/workspace/src/lib/theme/unzip.ts").href);
const { compileSafeCss } = await import(pathToFileURL("/workspace/src/lib/theme/safe-css.ts").href);

const PACK = {
  schemaVersion: 1,
  id: "preset-drop-probe",
  name: "巷雨试装",
  image: "background.jpg",
  appearance: "dark",
};

const CSS = `[data-ds-part="header"] {
  background-color: var(--ds-theme-color-panel);
  border-color: var(--ds-theme-color-accent);
  color: var(--ds-theme-color-text);
}
[data-ds-part="composer"]:hover {
  border-color: var(--ds-theme-color-accent-alt);
}
`;

test("safe css accepts registered parts and rejects the rest", () => {
  const ok = compileSafeCss(CSS);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.match(ok.css, /data-ds-part="header"/);
    assert.doesNotMatch(ok.css, /url\(/);
  }
  assert.equal(compileSafeCss(`body { color: red; }`).ok, false);
  assert.equal(compileSafeCss(`[data-ds-part="sidebar"] { background-color: url(https://evil); }`).ok, false);
  assert.equal(compileSafeCss(`[data-ds-part="titlebar"] { color: #fff; }`).ok, false);
});

test("unzip strips one wrap folder and inflates deflate entries", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-pack-"));
  const nested = join(dir, "巷雨");
  execFileSync("mkdir", ["-p", nested]);
  writeFileSync(join(nested, "theme.json"), JSON.stringify(PACK));
  writeFileSync(join(nested, "theme.css"), CSS);
  const jpg = readFileSync("/workspace/public/dream-skin/neon-alley.jpg");
  writeFileSync(join(nested, "background.jpg"), jpg);
  const zipPath = join(dir, "pack.zip");
  execFileSync("python3", [
    "-c",
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED); z.write(sys.argv[2], '巷雨/theme.json'); z.write(sys.argv[3], '巷雨/theme.css'); z.write(sys.argv[4], '巷雨/background.jpg'); z.close()",
    zipPath,
    join(nested, "theme.json"),
    join(nested, "theme.css"),
    join(nested, "background.jpg"),
  ]);
  const entries = await unzipBytes(readFileSync(zipPath));
  assert.deepEqual(entries.map((e) => e.name).sort(), ["background.jpg", "theme.css", "theme.json"]);
  const json = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === "theme.json").bytes));
  assert.equal(json.name, "巷雨试装");
  const css = new TextDecoder().decode(entries.find((e) => e.name === "theme.css").bytes);
  assert.match(css, /data-ds-part="header"/);
  const image = entries.find((e) => e.name === "background.jpg").bytes;
  assert.ok(image.byteLength > 1000);
  rmSync(dir, { recursive: true, force: true });
});

const { zipStore, strToBytes } = await import(pathToFileURL("/workspace/src/lib/theme/zip-write.ts").href);
const { mergeBundles } = await import(pathToFileURL("/workspace/src/lib/remote/merge.ts").href);

test("zip store roundtrips through unzip", async () => {
  const packed = zipStore([
    { name: "theme.json", data: strToBytes(JSON.stringify(PACK)) },
    { name: "theme.css", data: strToBytes(CSS) },
  ]);
  const entries = await unzipBytes(packed);
  assert.deepEqual(entries.map((e) => e.name).sort(), ["theme.css", "theme.json"]);
});

test("merge unions remote sessions without dropping local", () => {
  const local = {
    version: 1,
    updatedAt: 10,
    themeId: "a",
    appearance: "dark",
    customThemes: [],
    sessions: [{ id: "l", title: "local", mode: "plan", model: "x", status: "idle", messages: [], updatedAt: 1 }],
    activeSessionId: "l",
    files: {},
  };
  const remote = {
    version: 1,
    updatedAt: 20,
    themeId: "b",
    appearance: "dark",
    customThemes: [],
    sessions: [{ id: "r", title: "host", mode: "plan", model: "x", status: "idle", messages: [], updatedAt: 2 }],
    activeSessionId: "r",
    files: {},
  };
  const merged = mergeBundles(local, remote, { theme: true, sessions: true, files: true });
  assert.equal(merged.bundle.themeId, "b");
  assert.equal(merged.bundle.sessions.length, 2);
});
