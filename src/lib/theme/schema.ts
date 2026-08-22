export const OC_THEME_SCHEMA = "https://opencode.ai/theme.json";

export const THEME_KEYS = [
  "primary",
  "secondary",
  "accent",
  "error",
  "warning",
  "success",
  "info",
  "text",
  "textMuted",
  "background",
  "backgroundPanel",
  "backgroundElement",
  "border",
  "borderActive",
  "borderSubtle",
  "diffAdded",
  "diffRemoved",
  "diffContext",
  "diffHunkHeader",
  "diffHighlightAdded",
  "diffHighlightRemoved",
  "diffAddedBg",
  "diffRemovedBg",
  "diffContextBg",
  "diffLineNumber",
  "diffAddedLineNumberBg",
  "diffRemovedLineNumberBg",
  "markdownText",
  "markdownHeading",
  "markdownLink",
  "markdownLinkText",
  "markdownCode",
  "markdownBlockQuote",
  "markdownEmph",
  "markdownStrong",
  "markdownHorizontalRule",
  "markdownListItem",
  "markdownListEnumeration",
  "markdownImage",
  "markdownImageText",
  "markdownCodeBlock",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export type ColorValue = string | { dark: string; light: string };

export type OpenCodeThemeFile = {
  $schema?: string;
  defs?: Record<string, string>;
  theme: Partial<Record<ThemeKey, ColorValue>>;
};

export type ThemeSource = "opencode" | "marketplace" | "codex" | "vscode" | "custom";

export type ThemeMeta = {
  id: string;
  name: string;
  source: ThemeSource;
  origin: string;
  appearance: "dark" | "light" | "both";
};

export type CatalogEntry = ThemeMeta & {
  file: OpenCodeThemeFile;
  dreamSkin?: import("./dream-skin").DreamSkinPack;
  wallpaper?: string;
  dreamCss?: string;
};

export type ResolvedTheme = Record<ThemeKey, string>;

export type Appearance = "dark" | "light";
