import { adaptDreamSkin, isDreamSkinPack, type DreamSkinPack } from "./dream-skin";
import { importThemeJson } from "./import";
import { compileSafeCss } from "./safe-css";
import type { CatalogEntry } from "./schema";
import { unzipBytes } from "./unzip";

const IMAGE_NAMES = new Set(["background.jpg", "background.jpeg", "background.png", "background.webp"]);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const SKIP = new Set(["manifest.json", "manifest.sig", "license.txt", "readme.md", ".ds_store"]);

export type PackImportResult =
  | {
      ok: true;
      entry: CatalogEntry;
      warnings: string[];
    }
  | { ok: false; error: string };

type NamedBytes = { name: string; bytes: Uint8Array };

function basename(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function mimeFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function bytesToText(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

function dataUrlFrom(bytes: Uint8Array, mime: string) {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

async function compressWallpaper(dataUrl: string): Promise<string> {
  if (typeof Image === "undefined" || typeof document === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1600;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function pickImage(files: NamedBytes[], wanted?: string) {
  const map = new Map(files.map((f) => [basename(f.name).toLowerCase(), f]));
  if (wanted) {
    const hit = map.get(basename(wanted).toLowerCase());
    if (hit) return hit;
  }
  for (const name of IMAGE_NAMES) {
    const hit = map.get(name);
    if (hit) return hit;
  }
  return files.find((f) => IMAGE_EXT.test(basename(f.name)));
}

function toEntryId(id: string) {
  const clean = id.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 48) || "pack";
  return `pack-${clean}-${Date.now().toString(36)}`;
}

function appearanceOf(pack: DreamSkinPack): CatalogEntry["appearance"] {
  if (pack.appearance === "light") return "light";
  if (pack.appearance === "auto") return "both";
  return "dark";
}

export async function importPackEntries(entries: NamedBytes[]): Promise<PackImportResult> {
  const files = entries.filter((e) => {
    const base = basename(e.name).toLowerCase();
    if (!base || base.startsWith(".")) return false;
    if (SKIP.has(base)) return false;
    return true;
  });
  const jsonFile = files.find((f) => basename(f.name).toLowerCase() === "theme.json");
  if (!jsonFile) return { ok: false, error: "主题包缺少 theme.json。" };
  const text = bytesToText(jsonFile.bytes);
  const parsed = importThemeJson(text);
  if (!parsed.ok) return parsed;

  const warnings: string[] = [];
  const pack = parsed.dreamSkin;
  let wallpaper: string | undefined;
  let dreamCss: string | undefined;

  const image = pickImage(files, pack?.image);
  if (image) {
    wallpaper = await compressWallpaper(dataUrlFrom(image.bytes, mimeFor(image.name)));
  } else if (pack) {
    warnings.push("包里没有壁纸，只写入了颜色。");
  }

  const cssFile = files.find((f) => basename(f.name).toLowerCase() === "theme.css");
  if (cssFile) {
    const compiled = compileSafeCss(bytesToText(cssFile.bytes));
    if (compiled.ok) dreamCss = compiled.css;
    else warnings.push(`theme.css 未采用：${compiled.error}`);
  }

  if (pack) {
    const entry: CatalogEntry = {
      id: toEntryId(pack.id),
      name: pack.name,
      source: "codex",
      origin: "imported · Dream Skin 包",
      appearance: appearanceOf(pack),
      file: adaptDreamSkin(pack),
      dreamSkin: pack,
      wallpaper,
      dreamCss,
    };
    return { ok: true, entry, warnings };
  }

  const entry: CatalogEntry = {
    id: toEntryId(parsed.name),
    name: parsed.name,
    source: parsed.source,
    origin: `imported · ${parsed.format}`,
    appearance: "both",
    file: parsed.file,
    wallpaper,
    dreamCss,
  };
  return { ok: true, entry, warnings };
}

async function fileToEntry(file: File): Promise<NamedBytes> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, bytes: buf };
}

function isZip(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";
}

export async function importThemeFiles(input: File[]): Promise<PackImportResult> {
  if (!input.length) return { ok: false, error: "没有收到文件。" };
  const zip = input.find(isZip);
  if (zip) {
    if (zip.size > 32 * 1024 * 1024) return { ok: false, error: "主题包超过 32 MiB 上限。" };
    try {
      const buf = await zip.arrayBuffer();
      const entries = await unzipBytes(buf);
      return importPackEntries(entries);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ZIP 解压失败。" };
    }
  }

  const named: NamedBytes[] = [];
  for (const file of input) {
    named.push(await fileToEntry(file));
  }
  const hasJson = named.some((f) => basename(f.name).toLowerCase() === "theme.json" || f.name.toLowerCase().endsWith(".json"));
  if (!hasJson && named.length === 1 && IMAGE_EXT.test(named[0]!.name)) {
    return { ok: false, error: "请把 theme.json 和壁纸一起丢进来，或丢整个 ZIP 包。" };
  }
  const json = named.find((f) => basename(f.name).toLowerCase() === "theme.json") ?? named.find((f) => f.name.toLowerCase().endsWith(".json"));
  if (json && basename(json.name).toLowerCase() !== "theme.json") {
    named.push({ name: "theme.json", bytes: json.bytes });
  }
  return importPackEntries(named);
}

export function isDreamSkinJsonText(text: string) {
  try {
    return isDreamSkinPack(JSON.parse(text));
  } catch {
    return false;
  }
}
