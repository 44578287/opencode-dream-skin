import {
  THEME_KEYS,
  type Appearance,
  type ColorValue,
  type OpenCodeThemeFile,
  type ResolvedTheme,
  type ThemeKey,
} from "./schema";

function lookup(raw: string, defs: Record<string, string>, seen: Set<string>): string {
  if (!raw || raw === "none") return "transparent";
  if (raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl")) return raw;
  if (/^\d+$/.test(raw)) return ansi256(Number(raw));
  if (defs[raw] && !seen.has(raw)) {
    seen.add(raw);
    return lookup(defs[raw], defs, seen);
  }
  return raw;
}

function pick(value: ColorValue | undefined, appearance: Appearance, defs: Record<string, string>): string | undefined {
  if (value == null) return undefined;
  const raw = typeof value === "string" ? value : value[appearance] ?? value.dark ?? value.light;
  return lookup(raw, defs, new Set());
}

export function resolveTheme(file: OpenCodeThemeFile, appearance: Appearance): ResolvedTheme {
  const defs = file.defs ?? {};
  const out = {} as ResolvedTheme;
  for (const key of THEME_KEYS) {
    const resolved = pick(file.theme[key], appearance, defs);
    if (resolved) out[key] = resolved;
  }
  return withFallbacks(out, appearance);
}

function withFallbacks(partial: Partial<ResolvedTheme>, appearance: Appearance): ResolvedTheme {
  const dark = appearance === "dark";
  const base: ResolvedTheme = {
    primary: dark ? "#7aa2f7" : "#3d59a1",
    secondary: dark ? "#bb9af7" : "#9854de",
    accent: dark ? "#7dcfff" : "#0d9ad1",
    error: dark ? "#f7768e" : "#c53b53",
    warning: dark ? "#e0af68" : "#8c6c3e",
    success: dark ? "#9ece6a" : "#587539",
    info: dark ? "#7aa2f7" : "#3d59a1",
    text: dark ? "#c0caf5" : "#343b58",
    textMuted: dark ? "#565f89" : "#6c6f85",
    background: dark ? "#1a1b26" : "#e1e2e7",
    backgroundPanel: dark ? "#16161e" : "#d5d6db",
    backgroundElement: dark ? "#292e42" : "#c8c9d0",
    border: dark ? "#292e42" : "#c8c9d0",
    borderActive: dark ? "#3b4261" : "#9699a3",
    borderSubtle: dark ? "#1f2335" : "#d5d6db",
    diffAdded: dark ? "#9ece6a" : "#587539",
    diffRemoved: dark ? "#f7768e" : "#c53b53",
    diffContext: dark ? "#565f89" : "#6c6f85",
    diffHunkHeader: dark ? "#565f89" : "#6c6f85",
    diffHighlightAdded: dark ? "#9ece6a" : "#587539",
    diffHighlightRemoved: dark ? "#f7768e" : "#c53b53",
    diffAddedBg: dark ? "#1e2a1e" : "#d4e5d4",
    diffRemovedBg: dark ? "#2a1e22" : "#f0d6d8",
    diffContextBg: dark ? "#16161e" : "#d5d6db",
    diffLineNumber: dark ? "#3b4261" : "#9699a3",
    diffAddedLineNumberBg: dark ? "#1e2a1e" : "#d4e5d4",
    diffRemovedLineNumberBg: dark ? "#2a1e22" : "#f0d6d8",
    markdownText: dark ? "#c0caf5" : "#343b58",
    markdownHeading: dark ? "#7aa2f7" : "#3d59a1",
    markdownLink: dark ? "#7dcfff" : "#0d9ad1",
    markdownLinkText: dark ? "#bb9af7" : "#9854de",
    markdownCode: dark ? "#9ece6a" : "#587539",
    markdownBlockQuote: dark ? "#565f89" : "#6c6f85",
    markdownEmph: dark ? "#e0af68" : "#8c6c3e",
    markdownStrong: dark ? "#e0af68" : "#8c6c3e",
    markdownHorizontalRule: dark ? "#3b4261" : "#9699a3",
    markdownListItem: dark ? "#7aa2f7" : "#3d59a1",
    markdownListEnumeration: dark ? "#7dcfff" : "#0d9ad1",
    markdownImage: dark ? "#7dcfff" : "#0d9ad1",
    markdownImageText: dark ? "#bb9af7" : "#9854de",
    markdownCodeBlock: dark ? "#c0caf5" : "#343b58",
    syntaxComment: dark ? "#565f89" : "#6c6f85",
    syntaxKeyword: dark ? "#bb9af7" : "#9854de",
    syntaxFunction: dark ? "#7aa2f7" : "#3d59a1",
    syntaxVariable: dark ? "#c0caf5" : "#343b58",
    syntaxString: dark ? "#9ece6a" : "#587539",
    syntaxNumber: dark ? "#ff9e64" : "#b15c00",
    syntaxType: dark ? "#2ac3de" : "#0d9ad1",
    syntaxOperator: dark ? "#89ddff" : "#0d9ad1",
    syntaxPunctuation: dark ? "#c0caf5" : "#343b58",
  };
  return { ...base, ...partial };
}

export function applyThemeVars(resolved: ResolvedTheme, root: HTMLElement = document.documentElement) {
  for (const key of THEME_KEYS) {
    root.style.setProperty(`--oc-${key}`, resolved[key]);
  }
  root.style.setProperty("--oc-primary-fg", contrastInk(resolved.primary));
  root.style.setProperty("--oc-accent-fg", contrastInk(resolved.accent));
  root.style.colorScheme = luminance(resolved.background) > 0.45 ? "light" : "dark";
}

export function contrastInk(hex: string) {
  return luminance(hex) > 0.55 ? "#0c0d12" : "#f4f5f8";
}

export function luminance(hex: string) {
  const { r, g, b } = parseHex(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function parseHex(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  return {
    r: parseInt(v.slice(0, 2), 16) || 0,
    g: parseInt(v.slice(2, 4), 16) || 0,
    b: parseInt(v.slice(4, 6), 16) || 0,
  };
}

function ansi256(n: number) {
  if (n < 16) {
    const basic = [
      "#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#c0c0c0",
      "#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
    ];
    return basic[n] ?? "#808080";
  }
  if (n < 232) {
    const i = n - 16;
    const levels = [0, 95, 135, 175, 215, 255];
    const r = levels[Math.floor(i / 36) % 6];
    const g = levels[Math.floor(i / 6) % 6];
    const b = levels[i % 6];
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  const gray = 8 + (n - 232) * 10;
  const h = Math.max(0, Math.min(255, gray)).toString(16).padStart(2, "0");
  return `#${h}${h}${h}`;
}

export function swatch(file: OpenCodeThemeFile, appearance: Appearance) {
  const r = resolveTheme(file, appearance);
  return [r.background, r.backgroundPanel, r.primary, r.accent, r.success, r.syntaxKeyword];
}
