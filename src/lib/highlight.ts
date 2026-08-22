export type Token = { text: string; kind: "plain" | "comment" | "keyword" | "string" | "number" | "func" | "type" | "punct" };

const KEYWORDS = new Set([
  "import", "export", "from", "const", "let", "var", "function", "return", "await", "async",
  "class", "extends", "new", "if", "else", "for", "while", "switch", "case", "break",
  "type", "interface", "true", "false", "null", "undefined", "of", "in", "try", "catch",
  "throw", "void", "typeof", "as", "default", "private", "public", "readonly",
]);

export function tokenize(source: string, language: string): Token[][] {
  return source.split("\n").map((line) => tokenizeLine(line, language));
}

function tokenizeLine(line: string, language: string): Token[] {
  if (language === "md") {
    if (line.startsWith("#")) return [{ text: line, kind: "keyword" }];
    if (line.startsWith("- ") || line.startsWith("* ")) return [{ text: line, kind: "func" }];
    return splitInline(line);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (language !== "json" && line.slice(i, i + 2) === "//") {
      tokens.push({ text: line.slice(i), kind: "comment" });
      break;
    }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j += 2;
        else j++;
      }
      tokens.push({ text: line.slice(i, j + 1), kind: "string" });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[0-9_.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), kind: "number" });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const next = line.slice(j).match(/^\s*\(/);
      const kind: Token["kind"] = KEYWORDS.has(word)
        ? "keyword"
        : /^[A-Z]/.test(word)
          ? "type"
          : next
            ? "func"
            : "plain";
      tokens.push({ text: word, kind });
      i = j;
      continue;
    }
    if ("{}[]().,;:=<>+-*/|&!?".includes(ch)) {
      tokens.push({ text: ch, kind: "punct" });
      i++;
      continue;
    }
    tokens.push({ text: ch, kind: "plain" });
    i++;
  }
  return tokens.length ? tokens : [{ text: " ", kind: "plain" }];
}

function splitInline(line: string): Token[] {
  const parts = line.split(/(`[^`]+`)/g);
  return parts.filter(Boolean).map((text) => ({
    text,
    kind: text.startsWith("`") ? "string" : "plain",
  }));
}
