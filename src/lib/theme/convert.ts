import { resolveTheme } from "./resolve";
import type { CatalogEntry } from "./schema";
import type { DreamSkinPack } from "./dream-skin";
import { compileSafeCss } from "./safe-css";

/** Turn any catalog theme into a Dream Skin pack (colors + chrome copy). */
export function toDreamSkinPack(entry: CatalogEntry): DreamSkinPack {
  if (entry.dreamSkin) return entry.dreamSkin;
  const dark = resolveTheme(entry.file, "dark");
  return {
    schemaVersion: 1,
    id: entry.id,
    name: entry.name,
    brandSubtitle: "OPENCODE DREAM SKIN",
    tagline: entry.origin,
    statusText: `${entry.name.toUpperCase().slice(0, 18)} ONLINE`,
    quote: "MAKE SOMETHING WONDERFUL",
    image: "background.jpg",
    appearance: entry.appearance === "light" ? "light" : "dark",
    art: { focusX: 0.76, focusY: 0.45, safeArea: "left", taskMode: "ambient" },
    colors: {
      background: dark.background,
      panel: dark.backgroundPanel,
      panelAlt: dark.backgroundElement,
      accent: dark.primary,
      accentAlt: dark.accent,
      secondary: dark.secondary,
      highlight: dark.error,
      text: dark.text,
      muted: dark.textMuted,
      line: dark.border,
    },
  };
}

/** Minimal Safe CSS so exported packs match the official 12-part contract. */
export function generatedPackCss(pack: DreamSkinPack): string {
  const source = `[data-ds-part="header"] {
  border-color: var(--ds-theme-color-line);
  background-color: var(--ds-theme-color-panel);
}
[data-ds-part="sidebar"] {
  background-color: var(--ds-theme-color-panel);
  border-color: var(--ds-theme-color-line);
}
[data-ds-part="composer"] {
  background-color: var(--ds-theme-color-panel);
  border-color: var(--ds-theme-color-line);
}
[data-ds-part="home-hero"] {
  color: var(--ds-theme-color-accent);
}
[data-ds-part="dialog"] {
  background-color: var(--ds-theme-color-panel);
  border-color: var(--ds-theme-color-line);
}`;
  const compiled = compileSafeCss(source);
  return compiled.ok ? compiled.css : source;
}

export function packJson(pack: DreamSkinPack) {
  return `${JSON.stringify(pack, null, 2)}\n`;
}
