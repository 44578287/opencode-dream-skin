import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const zipPath = "/workspace/screenshots/drop-pack.zip";
mkdirSync("/workspace/screenshots", { recursive: true });
execFileSync("python3", [
  "-c",
  `
import json, zipfile, sys
pack = {
  "schemaVersion": 1,
  "id": "preset-drop-probe",
  "name": "巷雨试装",
  "tagline": "dropped zip onto opencode",
  "quote": "DROP THE PACK",
  "statusText": "PACK ONLINE",
  "image": "background.jpg",
  "appearance": "dark",
  "art": {"focusX": 0.82, "focusY": 0.42, "safeArea": "left"},
  "colors": {
    "background": "#0a0c12",
    "panel": "#141824",
    "panelAlt": "#1c2233",
    "accent": "#6ee7ff",
    "accentAlt": "#c4b5fd",
    "secondary": "#38bdf8",
    "highlight": "#fb7185",
    "text": "#eef4ff",
    "muted": "#93a4c3",
    "line": "rgba(110, 231, 255, .28)"
  }
}
css = '''[data-ds-part="header"] {
  border-color: var(--ds-theme-color-accent);
  color: var(--ds-theme-color-text);
}
[data-ds-part="home-hero"] {
  color: var(--ds-theme-color-accent);
}
'''
z = zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED)
z.writestr("巷雨/theme.json", json.dumps(pack))
z.writestr("巷雨/theme.css", css)
z.write(sys.argv[2], "巷雨/background.jpg")
z.close()
`,
  zipPath,
  "/workspace/public/dream-skin/neon-alley.jpg",
]);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("opencode-desktop-v4"));
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: /Gothic Void Crusade|主题/ }).first().click();
await page.getByText("丢主题包").waitFor();
await page.locator('input[accept*=".zip"]').setInputFiles(zipPath);
await page.getByText("已装上主题包「巷雨试装」").waitFor({ timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/drop-pack-studio.png" });
await page.getByRole("button", { name: "关闭" }).click();
await page.getByText("PACK ONLINE").first().waitFor({ timeout: 8000 });
await page.getByText("DROP THE PACK").first().waitFor();
const headerBorder = await page.locator("[data-ds-part='header']").evaluate((el) => getComputedStyle(el).borderBottomColor);
const cssTag = await page.locator("#dream-skin-pack-css").count();
const quotes = await page.locator("[data-ds-part='home-hero']").count();
await page.screenshot({ path: "/workspace/screenshots/drop-pack-shell.png" });
await browser.close();
console.log(
  JSON.stringify(
    {
      ok: errors.length === 0,
      errors,
      headerBorder,
      cssTag,
      quotes,
      zipBytes: readFileSync(zipPath).byteLength,
    },
    null,
    2,
  ),
);
if (errors.length) process.exit(1);
