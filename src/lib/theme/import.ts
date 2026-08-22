import { OC_THEME_SCHEMA, THEME_KEYS, type OpenCodeThemeFile, type ThemeKey, type ThemeSource } from "./schema";
import { bundle, type Face } from "./factory";
import { adaptDreamSkin, isDreamSkinPack, DREAM_SKIN_SAMPLE, type DreamSkinPack } from "./dream-skin";

export type DetectedFormat = "opencode" | "vscode" | "codex" | "dreamskin" | "unknown";

export type ImportResult = {
  ok: true;
  format: Exclude<DetectedFormat, "unknown">;
  name: string;
  file: OpenCodeThemeFile;
  source: ThemeSource;
  dreamSkin?: DreamSkinPack;
} | {
  ok: false;
  error: string;
};

export function detectFormat(raw: unknown): DetectedFormat {
  if (!raw || typeof raw !== "object") return "unknown";
  const obj = raw as Record<string, unknown>;
  if (isDreamSkinPack(obj)) return "dreamskin";
  if (obj.theme && typeof obj.theme === "object") {
    const theme = obj.theme as Record<string, unknown>;
    if ("background" in theme || "primary" in theme || "text" in theme) return "opencode";
    if ("ink" in theme && "surface" in theme) return "codex";
  }
  if (obj.colors && typeof obj.colors === "object") return "vscode";
  if (typeof obj.codeThemeId === "string") return "codex";
  return "unknown";
}

export function importThemeJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON 无法解析。请粘贴 Codex Dream Skin 的 theme.json，或 OpenCode / VS Code 主题。" };
  }
  const format = detectFormat(parsed);
  if (format === "unknown") {
    return { ok: false, error: "无法识别格式。支持 Dream Skin schemaVersion 1、OpenCode theme.json、VS Code color theme。" };
  }
  if (format === "dreamskin") {
    const pack = parsed as DreamSkinPack;
    return {
      ok: true,
      format,
      name: pack.name,
      file: adaptDreamSkin(pack),
      source: "codex",
      dreamSkin: pack,
    };
  }
  if (format === "opencode") {
    const file = parsed as OpenCodeThemeFile;
    if (!file.theme) return { ok: false, error: "OpenCode 主题缺少 theme 字段。" };
    return {
      ok: true,
      format,
      name: guessName(parsed, "Imported OpenCode"),
      file: { $schema: OC_THEME_SCHEMA, defs: file.defs, theme: file.theme },
      source: "custom",
    };
  }
  if (format === "vscode") {
    return {
      ok: true,
      format,
      name: guessName(parsed, "Imported VS Code"),
      file: fromVscode(parsed as VscodeTheme),
      source: "vscode",
    };
  }
  return {
    ok: true,
    format: "codex",
    name: guessName(parsed, "Imported Codex"),
    file: fromCodex(parsed as CodexTheme),
    source: "codex",
  };
}

function guessName(raw: unknown, fallback: string) {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
  if (typeof obj.codeThemeId === "string" && obj.codeThemeId.trim()) return `Codex ${obj.codeThemeId}`;
  return fallback;
}

type VscodeTheme = {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
  tokenColors?: Array<{
    scope?: string | string[];
    settings?: { foreground?: string; background?: string };
  }>;
};

function fromVscode(vs: VscodeTheme): OpenCodeThemeFile {
  const c = vs.colors ?? {};
  const token = (scope: string, fallback: string) => {
    const hit = vs.tokenColors?.find((t) => {
      const s = t.scope;
      if (!s) return false;
      const list = Array.isArray(s) ? s : s.split(",").map((x) => x.trim());
      return list.some((item) => item === scope || item.startsWith(`${scope}.`) || item.endsWith(scope));
    });
    return hit?.settings?.foreground ?? fallback;
  };
  const isLight = vs.type === "light" || luminanceGuess(c["editor.background"] ?? "#1e1e1e") > 0.5;
  const face: Face = {
    bg: c["editor.background"] ?? c["sideBar.background"] ?? "#1e1e1e",
    panel: c["sideBar.background"] ?? c["panel.background"] ?? "#181818",
    element: c["activityBar.background"] ?? c["tab.activeBackground"] ?? "#252525",
    border: c["panel.border"] ?? c["sideBar.border"] ?? "#333333",
    borderActive: c["focusBorder"] ?? c["tab.activeBorder"] ?? "#007acc",
    text: c["editor.foreground"] ?? c["foreground"] ?? "#d4d4d4",
    muted: c["descriptionForeground"] ?? c["editorLineNumber.foreground"] ?? "#6e6e6e",
    primary: c["focusBorder"] ?? c["button.background"] ?? "#007acc",
    secondary: token("variable", token("entity.name.function", "#c586c0")),
    accent: c["terminal.ansiCyan"] ?? token("string", "#4ec9b0"),
    error: c["errorForeground"] ?? c["editorError.foreground"] ?? "#f14c4c",
    warning: c["editorWarning.foreground"] ?? "#cca700",
    success: c["gitDecoration.addedResourceForeground"] ?? c["terminal.ansiGreen"] ?? "#89d185",
    comment: token("comment", "#6a9955"),
    keyword: token("keyword", "#569cd6"),
    func: token("entity.name.function", "#dcdcaa"),
    variable: token("variable", "#9cdcfe"),
    string: token("string", "#ce9178"),
    number: token("constant.numeric", "#b5cea8"),
    type: token("entity.name.type", token("support.type", "#4ec9b0")),
  };
  const other: Face = invertSoft(face);
  return bundle(isLight ? other : face, isLight ? face : other);
}

type CodexTheme = {
  name?: string;
  codeThemeId?: string;
  variant?: string;
  theme?: {
    accent?: string;
    ink?: string;
    surface?: string;
    contrast?: number;
    semanticColors?: {
      diffAdded?: string;
      diffRemoved?: string;
      skill?: string;
    };
  };
};

function fromCodex(cx: CodexTheme): OpenCodeThemeFile {
  const t = cx.theme ?? {};
  const surface = t.surface ?? "#1e1e1e";
  const ink = t.ink ?? "#e6e6e6";
  const accent = t.accent ?? "#6b9eff";
  const added = t.semanticColors?.diffAdded ?? "#7dcea0";
  const removed = t.semanticColors?.diffRemoved ?? "#e06c75";
  const skill = t.semanticColors?.skill ?? accent;
  const isLight = cx.variant === "light" || luminanceGuess(surface) > 0.5;
  const muted = mixHex(ink, surface, 0.45);
  const border = mixHex(ink, surface, 0.18);
  const panel = mixHex(ink, surface, isLight ? 0.06 : 0.08);
  const element = mixHex(ink, surface, isLight ? 0.1 : 0.14);
  const face: Face = {
    bg: surface,
    panel,
    element,
    border,
    borderActive: accent,
    text: ink,
    muted,
    primary: accent,
    secondary: skill,
    accent,
    error: removed,
    warning: mixHex(accent, "#e5c07b", 0.5),
    success: added,
    comment: muted,
    keyword: skill,
    func: accent,
    variable: ink,
    string: added,
    number: mixHex(accent, "#e5c07b", 0.6),
    type: accent,
  };
  const other = invertSoft(face);
  return bundle(isLight ? other : face, isLight ? face : other);
}

function invertSoft(f: Face): Face {
  const light = luminanceGuess(f.bg) > 0.5;
  if (light) {
    return {
      ...f,
      bg: "#141414",
      panel: "#1b1b1b",
      element: "#242424",
      border: "#333333",
      text: "#ececec",
      muted: "#8a8a8a",
      variable: "#ececec",
    };
  }
  return {
    ...f,
    bg: "#f6f4f1",
    panel: "#ece9e4",
    element: "#e2ddd6",
    border: "#d2cbc2",
    text: "#1c1917",
    muted: "#6f6a63",
    variable: "#1c1917",
  };
}

function luminanceGuess(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixHex(over: string, base: string, amount: number) {
  const a = parse(over);
  const b = parse(base);
  const t = Math.min(1, Math.max(0, amount));
  const ch = (x: number, y: number) => Math.round(y + (x - y) * t);
  return `#${[ch(a.r, b.r), ch(a.g, b.g), ch(a.b, b.b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function parse(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(v.slice(0, 2), 16) || 0,
    g: parseInt(v.slice(2, 4), 16) || 0,
    b: parseInt(v.slice(4, 6), 16) || 0,
  };
}

export function exportOpenCodeJson(file: OpenCodeThemeFile) {
  return JSON.stringify({ $schema: OC_THEME_SCHEMA, ...file, $schema2: undefined }, null, 2)
    .replace('"$schema2": undefined,\n', "");
}

export function sampleSnippet(format: "opencode" | "vscode" | "codex" | "dreamskin") {
  if (format === "dreamskin") return DREAM_SKIN_SAMPLE;
  if (format === "opencode") {
    return `{
  "$schema": "https://opencode.ai/theme.json",
  "theme": {
    "primary": { "dark": "#7aa2f7", "light": "#34548a" },
    "background": { "dark": "#1a1b26", "light": "#e1e2e7" },
    "text": { "dark": "#c0caf5", "light": "#343b58" }
  }
}`;
  }
  if (format === "vscode") {
    return `{
  "name": "My Theme",
  "type": "dark",
  "colors": {
    "editor.background": "#1a1b26",
    "editor.foreground": "#c0caf5",
    "focusBorder": "#7aa2f7",
    "sideBar.background": "#16161e"
  }
}`;
  }
  return `{
  "codeThemeId": "tokyonight",
  "variant": "dark",
  "theme": {
    "accent": "#7aa2f7",
    "ink": "#c0caf5",
    "surface": "#1a1b26",
    "semanticColors": { "diffAdded": "#9ece6a", "diffRemoved": "#f7768e" }
  }
}`;
}

export { THEME_KEYS };
export type { ThemeKey };
