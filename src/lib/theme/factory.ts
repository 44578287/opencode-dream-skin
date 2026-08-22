import { OC_THEME_SCHEMA, type OpenCodeThemeFile } from "./schema";

export type Face = {
  bg: string;
  panel: string;
  element: string;
  border: string;
  borderActive: string;
  borderSubtle?: string;
  text: string;
  muted: string;
  primary: string;
  secondary: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
  info?: string;
  comment: string;
  keyword: string;
  func: string;
  variable: string;
  string: string;
  number: string;
  type: string;
  operator?: string;
  punct?: string;
  diffAddedBg?: string;
  diffRemovedBg?: string;
};

function face(p: Face, mode: "dark" | "light") {
  const addedBg = p.diffAddedBg ?? (mode === "dark" ? mix(p.success, p.bg, 0.18) : mix(p.success, p.bg, 0.14));
  const removedBg = p.diffRemovedBg ?? (mode === "dark" ? mix(p.error, p.bg, 0.18) : mix(p.error, p.bg, 0.12));
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    error: p.error,
    warning: p.warning,
    success: p.success,
    info: p.info ?? p.primary,
    text: p.text,
    textMuted: p.muted,
    background: p.bg,
    backgroundPanel: p.panel,
    backgroundElement: p.element,
    border: p.border,
    borderActive: p.borderActive,
    borderSubtle: p.borderSubtle ?? p.border,
    diffAdded: p.success,
    diffRemoved: p.error,
    diffContext: p.muted,
    diffHunkHeader: p.muted,
    diffHighlightAdded: p.success,
    diffHighlightRemoved: p.error,
    diffAddedBg: addedBg,
    diffRemovedBg: removedBg,
    diffContextBg: p.panel,
    diffLineNumber: p.muted,
    diffAddedLineNumberBg: addedBg,
    diffRemovedLineNumberBg: removedBg,
    markdownText: p.text,
    markdownHeading: p.primary,
    markdownLink: p.accent,
    markdownLinkText: p.secondary,
    markdownCode: p.string,
    markdownBlockQuote: p.muted,
    markdownEmph: p.warning,
    markdownStrong: p.warning,
    markdownHorizontalRule: p.border,
    markdownListItem: p.primary,
    markdownListEnumeration: p.accent,
    markdownImage: p.accent,
    markdownImageText: p.secondary,
    markdownCodeBlock: p.text,
    syntaxComment: p.comment,
    syntaxKeyword: p.keyword,
    syntaxFunction: p.func,
    syntaxVariable: p.variable,
    syntaxString: p.string,
    syntaxNumber: p.number,
    syntaxType: p.type,
    syntaxOperator: p.operator ?? p.accent,
    syntaxPunctuation: p.punct ?? p.text,
  };
}

export function bundle(dark: Face, light: Face): OpenCodeThemeFile {
  const d = face(dark, "dark");
  const l = face(light, "light");
  const theme: OpenCodeThemeFile["theme"] = {};
  (Object.keys(d) as (keyof typeof d)[]).forEach((key) => {
    theme[key] = { dark: d[key], light: l[key] };
  });
  return { $schema: OC_THEME_SCHEMA, theme };
}

/** Blend `over` onto `base` by `amount` of over. */
export function mix(over: string, base: string, amount: number) {
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
