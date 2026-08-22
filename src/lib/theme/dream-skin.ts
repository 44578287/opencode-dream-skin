import { bundle, mix, type Face } from "./factory";
import { parseHex } from "./resolve";
import type { CatalogEntry, OpenCodeThemeFile } from "./schema";

export type DreamSkinColors = {
  background: string;
  panel: string;
  panelAlt: string;
  accent: string;
  accentAlt: string;
  secondary: string;
  highlight: string;
  text: string;
  muted: string;
  line: string;
};

export type DreamSkinArt = {
  focusX?: number;
  focusY?: number;
  safeArea?: "auto" | "left" | "right" | "center" | "none" | string;
  taskMode?: "auto" | "ambient" | "banner" | "full" | "off" | string;
};

/** Codex Dream Skin pack — schemaVersion 1, Fei-Away/Codex-Dream-Skin */
export type DreamSkinPack = {
  schemaVersion?: number;
  id: string;
  name: string;
  brandSubtitle?: string;
  tagline?: string;
  projectPrefix?: string;
  projectLabel?: string;
  statusText?: string;
  quote?: string;
  image?: string;
  appearance?: "dark" | "light" | "auto";
  art?: DreamSkinArt;
  colors?: Partial<DreamSkinColors>;
  promoTitle?: string;
  promoSub?: string;
  promoUrl?: string;
};

export function isDreamSkinPack(raw: unknown): raw is DreamSkinPack {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return false;
  if (o.schemaVersion === 1) return true;
  const colors = o.colors;
  if (colors && typeof colors === "object") {
    const c = colors as Record<string, unknown>;
    return "panel" in c && "accent" in c && "text" in c;
  }
  return typeof o.image === "string" && typeof o.tagline === "string";
}

const FALLBACK_DARK: DreamSkinColors = {
  background: "#0d0d0e",
  panel: "#171513",
  panelAlt: "#211d18",
  accent: "#c8a55a",
  accentAlt: "#e3c27a",
  secondary: "#74352e",
  highlight: "#8a2f27",
  text: "#f3ead7",
  muted: "#b5a386",
  line: "rgba(200, 165, 90, .28)",
};

export function resolveDreamColors(pack: DreamSkinPack): DreamSkinColors {
  const c = pack.colors ?? {};
  return { ...FALLBACK_DARK, ...c };
}

function faceFromPack(c: DreamSkinColors, mode: "dark" | "light"): Face {
  const border = solidLine(c.line, mode === "dark" ? mix(c.accent, c.background, 0.28) : mix(c.accent, c.background, 0.22));
  return {
    bg: c.background,
    panel: c.panel,
    element: c.panelAlt,
    border,
    borderActive: c.accent,
    text: c.text,
    muted: c.muted,
    primary: c.accent,
    secondary: c.secondary,
    accent: c.accentAlt,
    error: c.highlight,
    warning: c.accentAlt,
    success: mix(c.accentAlt, c.panel, 0.55),
    comment: c.muted,
    keyword: c.secondary,
    func: c.accent,
    variable: c.text,
    string: c.accentAlt,
    number: c.highlight,
    type: c.accentAlt,
    operator: c.accent,
  };
}

function invertFace(c: DreamSkinColors): DreamSkinColors {
  return {
    background: "#f6f1ea",
    panel: "#fffaf3",
    panelAlt: "#efe6d8",
    accent: c.accent,
    accentAlt: c.accentAlt,
    secondary: c.secondary,
    highlight: c.highlight,
    text: "#1c1712",
    muted: "#7a6d5c",
    line: mix(c.accent, "#f6f1ea", 0.22),
  };
}

/** Map a Dream Skin pack onto OpenCode theme.json tokens. */
export function adaptDreamSkin(pack: DreamSkinPack): OpenCodeThemeFile {
  const colors = resolveDreamColors(pack);
  const mode = pack.appearance === "light" ? "light" : "dark";
  const primary = faceFromPack(colors, mode);
  const alt = faceFromPack(pack.appearance === "auto" ? invertFace(colors) : colors, mode === "dark" ? "light" : "dark");
  return mode === "dark" ? bundle(primary, alt) : bundle(alt, primary);
}

export function toCatalogEntry(pack: DreamSkinPack, wallpaper?: string): CatalogEntry {
  const appearance = pack.appearance === "light" ? "light" : pack.appearance === "auto" ? "both" : "dark";
  return {
    id: pack.id,
    name: pack.name,
    source: "codex",
    origin: "Codex Dream Skin",
    appearance,
    file: adaptDreamSkin(pack),
    dreamSkin: pack,
    wallpaper,
  };
}

export function applyDreamSkin(
  pack: DreamSkinPack | undefined,
  wallpaper: string | undefined,
  css?: string,
  root: HTMLElement = document.documentElement,
) {
  if (!pack) {
    root.removeAttribute("data-dream-skin");
    root.removeAttribute("data-ds-safe");
    for (const name of DS_VARS) root.style.removeProperty(name);
    root.style.removeProperty("--ds-wallpaper");
    root.style.removeProperty("--ds-art-position");
    root.style.removeProperty("--ds-focus-x");
    root.style.removeProperty("--ds-focus-y");
    injectPackCss(undefined);
    return;
  }
  const c = resolveDreamColors(pack);
  root.setAttribute("data-dream-skin", "active");
  root.setAttribute("data-ds-safe", pack.art?.safeArea ?? "left");
  setVar(root, "--ds-bg", c.background);
  setVar(root, "--ds-panel", c.panel);
  setVar(root, "--ds-panel-2", c.panelAlt);
  setVar(root, "--ds-accent", c.accent);
  setVar(root, "--ds-accent-alt", c.accentAlt);
  setVar(root, "--ds-secondary", c.secondary);
  setVar(root, "--ds-highlight", c.highlight);
  setVar(root, "--ds-text", c.text);
  setVar(root, "--ds-muted", c.muted);
  setVar(root, "--ds-line", c.line);
  setRgb(root, "--ds-bg-rgb", c.background);
  setRgb(root, "--ds-panel-rgb", c.panel);
  setRgb(root, "--ds-panel-2-rgb", c.panelAlt);
  setRgb(root, "--ds-accent-rgb", c.accent);
  setRgb(root, "--ds-text-rgb", c.text);
  setRgb(root, "--ds-muted-rgb", c.muted);
  setVar(root, "--ds-theme-color-background", c.background);
  setVar(root, "--ds-theme-color-panel", c.panel);
  setVar(root, "--ds-theme-color-panel-alt", c.panelAlt);
  setVar(root, "--ds-theme-color-accent", c.accent);
  setVar(root, "--ds-theme-color-accent-alt", c.accentAlt);
  setVar(root, "--ds-theme-color-secondary", c.secondary);
  setVar(root, "--ds-theme-color-highlight", c.highlight);
  setVar(root, "--ds-theme-color-text", c.text);
  setVar(root, "--ds-theme-color-muted", c.muted);
  setVar(root, "--ds-theme-color-line", c.line);
  setVar(root, "--ds-theme-font-family", "var(--font-sans)");
  setVar(root, "--ds-theme-font-scale", "1");
  setVar(root, "--ds-theme-surface-opacity", "0.58");
  setVar(root, "--ds-theme-surface-blur", "18px");
  setVar(root, "--ds-theme-surface-radius", "8px");
  setVar(root, "--ds-theme-surface-border-alpha", "0.28");
  setVar(root, "--ds-theme-surface-shadow", "0 18px 40px rgb(0 0 0 / 0.28)");
  setVar(root, "--ds-theme-image-zoom", "1");
  setVar(root, "--ds-theme-image-dim", "0.18");
  setVar(root, "--ds-theme-image-task-intensity", "0.45");
  setVar(root, "--ds-theme-density-scale", "1");
  setVar(root, "--ds-theme-motion-level", "1");
  const fx = pack.art?.focusX ?? 0.76;
  const fy = pack.art?.focusY ?? 0.45;
  root.style.setProperty("--ds-focus-x", String(fx));
  root.style.setProperty("--ds-focus-y", String(fy));
  root.style.setProperty("--ds-theme-image-focus-x", String(fx));
  root.style.setProperty("--ds-theme-image-focus-y", String(fy));
  root.style.setProperty("--ds-art-position", `${Math.round(fx * 100)}% ${Math.round(fy * 100)}%`);
  if (wallpaper) {
    root.style.setProperty("--ds-wallpaper", `url(${JSON.stringify(wallpaper)})`);
  } else {
    root.style.removeProperty("--ds-wallpaper");
  }
  injectPackCss(css);
}

const DS_VARS = [
  "--ds-bg",
  "--ds-panel",
  "--ds-panel-2",
  "--ds-accent",
  "--ds-accent-alt",
  "--ds-secondary",
  "--ds-highlight",
  "--ds-text",
  "--ds-muted",
  "--ds-line",
  "--ds-bg-rgb",
  "--ds-panel-rgb",
  "--ds-panel-2-rgb",
  "--ds-accent-rgb",
  "--ds-text-rgb",
  "--ds-muted-rgb",
  "--ds-theme-color-background",
  "--ds-theme-color-panel",
  "--ds-theme-color-panel-alt",
  "--ds-theme-color-accent",
  "--ds-theme-color-accent-alt",
  "--ds-theme-color-secondary",
  "--ds-theme-color-highlight",
  "--ds-theme-color-text",
  "--ds-theme-color-muted",
  "--ds-theme-color-line",
  "--ds-theme-font-family",
  "--ds-theme-font-scale",
  "--ds-theme-surface-opacity",
  "--ds-theme-surface-blur",
  "--ds-theme-surface-radius",
  "--ds-theme-surface-border-alpha",
  "--ds-theme-surface-shadow",
  "--ds-theme-image-zoom",
  "--ds-theme-image-dim",
  "--ds-theme-image-task-intensity",
  "--ds-theme-density-scale",
  "--ds-theme-motion-level",
  "--ds-theme-image-focus-x",
  "--ds-theme-image-focus-y",
];

const PACK_STYLE_ID = "dream-skin-pack-css";

function injectPackCss(css: string | undefined) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(PACK_STYLE_ID);
  if (!css) {
    existing?.remove();
    return;
  }
  const el = existing instanceof HTMLStyleElement ? existing : document.createElement("style");
  el.id = PACK_STYLE_ID;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}

function setVar(root: HTMLElement, name: string, value: string) {
  root.style.setProperty(name, value);
}

function setRgb(root: HTMLElement, name: string, hex: string) {
  const { r, g, b } = parseHex(hex.startsWith("#") ? hex : "#808080");
  root.style.setProperty(name, `${r} ${g} ${b}`);
}

function solidLine(line: string, fallback: string) {
  if (line.startsWith("#")) return line;
  return fallback;
}

export const DREAM_SKIN_SAMPLE = `{
  "schemaVersion": 1,
  "id": "preset-gothic-void-crusade",
  "name": "Gothic Void Crusade",
  "tagline": "A solemn cathedral-world horizon for focused work.",
  "quote": "MAKE SOMETHING WONDERFUL",
  "image": "background.jpg",
  "appearance": "dark",
  "art": { "focusX": 0.76, "focusY": 0.45, "safeArea": "left", "taskMode": "ambient" },
  "colors": {
    "background": "#0d0d0e",
    "panel": "#171513",
    "panelAlt": "#211d18",
    "accent": "#c8a55a",
    "accentAlt": "#e3c27a",
    "secondary": "#74352e",
    "highlight": "#8a2f27",
    "text": "#f3ead7",
    "muted": "#b5a386",
    "line": "rgba(200, 165, 90, .28)"
  }
}`;
