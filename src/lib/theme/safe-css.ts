/** Codex Dream Skin Safe CSS — 12 registered parts, policy contract dreamskin-safe-css/1 */

export const DS_PARTS = [
  "root",
  "sidebar",
  "main",
  "header",
  "home",
  "home-hero",
  "project-list",
  "thread",
  "message",
  "composer",
  "composer-toolbar",
  "dialog",
] as const;

export type DsPart = (typeof DS_PARTS)[number];

const PART_SET = new Set<string>(DS_PARTS);
const STATE_SET = new Set(["hover", "focus-visible"]);
const SELECTOR = /^\[data-ds-part="([a-z]+(?:-[a-z]+)*)"\](?::([a-z-]+))?$/;

const PROPERTIES = new Set([
  "backdrop-filter",
  "background-color",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-color",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-radius",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-style",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "border-width",
  "box-shadow",
  "color",
  "column-gap",
  "font-family",
  "font-size",
  "font-weight",
  "gap",
  "letter-spacing",
  "line-height",
  "opacity",
  "row-gap",
  "transition-duration",
  "transition-property",
]);

const MAX_BYTES = 262144;
const MAX_RULES = 128;
const MAX_DECLARATIONS = 512;
const MAX_VALUE = 512;

const BANNED = /url\s*\(|expression\s*\(|javascript:|@import|<\/style|<script|behavior\s*:|binding\s*:/i;

export type SafeCssResult =
  | { ok: true; css: string; ruleCount: number }
  | { ok: false; error: string };

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitDecls(body: string): Array<[string, string]> | null {
  const out: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const raw of body.split(";")) {
    const piece = raw.trim();
    if (!piece) continue;
    const colon = piece.indexOf(":");
    if (colon <= 0) return null;
    const prop = piece.slice(0, colon).trim().toLowerCase();
    const value = piece.slice(colon + 1).trim();
    if (!PROPERTIES.has(prop)) return null;
    if (!value || value.length > MAX_VALUE) return null;
    if (BANNED.test(value)) return null;
    if (/[{}[\]@\\]|!important/i.test(value)) return null;
    if (seen.has(prop)) return null;
    seen.add(prop);
    out.push([prop, value]);
  }
  return out;
}

/** Validate community theme.css and emit a scoped stylesheet. */
export function compileSafeCss(source: string): SafeCssResult {
  if (typeof source !== "string") return { ok: false, error: "theme.css 无法读取。" };
  if (source.length > MAX_BYTES) return { ok: false, error: "theme.css 超过 256 KiB。" };
  if (BANNED.test(source)) return { ok: false, error: "theme.css 含有不允许的语法。" };
  const text = stripComments(source).trim();
  if (!text) return { ok: false, error: "theme.css 是空的。" };

  const rules: string[] = [];
  let declsTotal = 0;
  let rest = text;
  while (rest.trim()) {
    const start = rest.indexOf("{");
    const end = rest.indexOf("}");
    if (start < 0 || end < 0 || end < start) return { ok: false, error: "theme.css 括号不配对。" };
    const selector = rest.slice(0, start).trim();
    const body = rest.slice(start + 1, end);
    rest = rest.slice(end + 1);
    if (!selector || selector.includes(",") || selector.includes("\\")) {
      return { ok: false, error: `不支持的选择器：${selector || "(空)"}` };
    }
    const match = SELECTOR.exec(selector);
    if (!match) return { ok: false, error: `选择器必须是 [data-ds-part="…"]：${selector}` };
    const part = match[1]!;
    const state = match[2];
    if (!PART_SET.has(part)) return { ok: false, error: `未注册部件：${part}` };
    if (state && !STATE_SET.has(state)) return { ok: false, error: `不允许的伪类：${state}` };
    const decls = splitDecls(body);
    if (!decls) return { ok: false, error: `部件 ${part} 含有不允许的属性或取值。` };
    declsTotal += decls.length;
    if (decls.length > 64 || declsTotal > MAX_DECLARATIONS) {
      return { ok: false, error: "theme.css 声明过多。" };
    }
    const block = decls.map(([p, v]) => `  ${p}: ${v};`).join("\n");
    rules.push(`${selector} {\n${block}\n}`);
    if (part === "root") {
      const rootish = decls.filter(([p]) =>
        ["background-color", "color", "font-family", "font-size", "font-weight", "letter-spacing", "line-height"].includes(p),
      );
      if (rootish.length) {
        rules.push(
          `html[data-dream-skin="active"] body {\n${rootish.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`,
        );
      }
    }
  }
  if (rules.length > MAX_RULES) return { ok: false, error: "theme.css 规则过多。" };
  if (!rules.length) return { ok: false, error: "theme.css 没有有效规则。" };
  return {
    ok: true,
    ruleCount: rules.length,
    css: rules.join("\n"),
  };
}
