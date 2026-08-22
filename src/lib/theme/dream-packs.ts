import { toCatalogEntry, type DreamSkinPack } from "./dream-skin";
import type { CatalogEntry } from "./schema";

const gothic: DreamSkinPack = {
  schemaVersion: 1,
  id: "preset-gothic-void-crusade",
  name: "Gothic Void Crusade",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: "A solemn cathedral-world horizon for focused work.",
  projectPrefix: "Select project · ",
  projectLabel: "Select project",
  statusText: "VOID CRUSADE ONLINE",
  quote: "MAKE SOMETHING WONDERFUL",
  image: "background.jpg",
  appearance: "dark",
  art: { focusX: 0.76, focusY: 0.45, safeArea: "left", taskMode: "ambient" },
  colors: {
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
  },
  promoTitle: "Codex Dream Skin",
  promoSub: "Gothic Void Crusade",
  promoUrl: "https://github.com/Fei-Away/Codex-Dream-Skin",
};

const nightCity: DreamSkinPack = {
  schemaVersion: 1,
  id: "preset-night-city",
  name: "夜雨楼台",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: "雨里的霓虹，留给左边写代码。",
  statusText: "CITY ONLINE",
  quote: "MAKE SOMETHING WONDERFUL",
  image: "night-city.jpg",
  appearance: "dark",
  art: { focusX: 0.78, focusY: 0.42, safeArea: "left", taskMode: "ambient" },
  colors: {
    background: "#070814",
    panel: "#121428",
    panelAlt: "#1b1e3a",
    accent: "#ff4fd8",
    accentAlt: "#7ee8ff",
    secondary: "#5b4bff",
    highlight: "#ff6b9d",
    text: "#f4f2ff",
    muted: "#9aa0c8",
    line: "rgba(126, 232, 255, .28)",
  },
};

const torii: DreamSkinPack = {
  schemaVersion: 1,
  id: "preset-torii-rain",
  name: "朱门夜雨",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: "灯笼未灭，先把这一行写完。",
  statusText: "SHRINE ONLINE",
  quote: "MAKE SOMETHING WONDERFUL",
  image: "torii-rain.jpg",
  appearance: "dark",
  art: { focusX: 0.62, focusY: 0.48, safeArea: "left", taskMode: "ambient" },
  colors: {
    background: "#120806",
    panel: "#1c0e0c",
    panelAlt: "#2a1410",
    accent: "#e06b4f",
    accentAlt: "#f0a070",
    secondary: "#8a2f27",
    highlight: "#c45c4a",
    text: "#f3e6dc",
    muted: "#c4a090",
    line: "rgba(224, 107, 79, .28)",
  },
};

const hall: DreamSkinPack = {
  schemaVersion: 1,
  id: "preset-golden-hall",
  name: "金殿",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: "香火与金箔之间，只留一条思路。",
  statusText: "HALL ONLINE",
  quote: "MAKE SOMETHING WONDERFUL",
  image: "golden-hall.jpg",
  appearance: "dark",
  art: { focusX: 0.72, focusY: 0.46, safeArea: "left", taskMode: "ambient" },
  colors: {
    background: "#140f0a",
    panel: "#1c1610",
    panelAlt: "#2a2118",
    accent: "#d4af5a",
    accentAlt: "#f0d48a",
    secondary: "#8a5a28",
    highlight: "#c4883a",
    text: "#f6ecd4",
    muted: "#c4b090",
    line: "rgba(212, 175, 90, .28)",
  },
};

const alley: DreamSkinPack = {
  schemaVersion: 1,
  id: "preset-neon-alley",
  name: "巷雨",
  brandSubtitle: "CODEX DREAM SKIN",
  tagline: "蒸汽未散，光还在地面上。",
  statusText: "ALLEY ONLINE",
  quote: "MAKE SOMETHING WONDERFUL",
  image: "neon-alley.jpg",
  appearance: "dark",
  art: { focusX: 0.7, focusY: 0.5, safeArea: "left", taskMode: "ambient" },
  colors: {
    background: "#07080f",
    panel: "#10141c",
    panelAlt: "#1a2230",
    accent: "#5eead4",
    accentAlt: "#e879f9",
    secondary: "#38bdf8",
    highlight: "#f472b6",
    text: "#e8eef8",
    muted: "#94a3b8",
    line: "rgba(94, 234, 212, .28)",
  },
};

function pack(p: DreamSkinPack, file: string): CatalogEntry {
  return toCatalogEntry(p, `/dream-skin/${file}`);
}

export const DREAM_SKIN_CATALOG: CatalogEntry[] = [
  pack(gothic, "gothic-void-crusade.jpg"),
  pack(nightCity, "night-city.jpg"),
  pack(torii, "torii-rain.jpg"),
  pack(hall, "golden-hall.jpg"),
  pack(alley, "neon-alley.jpg"),
];

export const DEFAULT_THEME_ID = "preset-gothic-void-crusade";
