import { zipStore, strToBytes } from "./zip-write";
import { toDreamSkinPack, generatedPackCss, packJson } from "./convert";
import type { CatalogEntry } from "./schema";

function extFromUrl(url: string) {
  if (url.startsWith("data:image/png")) return "png";
  if (url.startsWith("data:image/webp")) return "webp";
  if (url.includes(".png")) return "png";
  if (url.includes(".webp")) return "webp";
  return "jpg";
}

function dataUrlToBytes(url: string): Uint8Array | null {
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const b64 = url.slice(comma + 1);
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function wallpaperBytes(url: string | undefined): Promise<{ name: string; data: Uint8Array } | null> {
  if (!url) return null;
  if (url.startsWith("data:")) {
    const data = dataUrlToBytes(url);
    if (!data) return null;
    return { name: `background.${extFromUrl(url)}`, data };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return { name: `background.${extFromUrl(url)}`, data: buf };
  } catch {
    return null;
  }
}

export async function exportDreamSkinZip(entry: CatalogEntry): Promise<{ filename: string; blob: Blob }> {
  const pack = toDreamSkinPack(entry);
  const image = await wallpaperBytes(entry.wallpaper);
  if (image) pack.image = image.name;
  const css = entry.dreamCss || generatedPackCss(pack);
  const files: { name: string; data: Uint8Array }[] = [
    { name: "theme.json", data: strToBytes(packJson(pack)) },
    { name: "theme.css", data: strToBytes(css.endsWith("\n") ? css : `${css}\n`) },
  ];
  if (image) files.push({ name: image.name, data: new Uint8Array(image.data) });
  const bytes = zipStore(files);
  const copy = new Uint8Array(bytes);
  return {
    filename: `${pack.id}.zip`,
    blob: new Blob([copy], { type: "application/zip" }),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
