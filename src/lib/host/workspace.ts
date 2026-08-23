import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { PROJECT_NAME, SEED_FILES } from "./seed.ts";

export const WORK_DIR = join(tmpdir(), "opencode-dreamskin-work");

export type FileEntry = { path: string; content: string; original: string };

const files = new Map<string, FileEntry>();

function safeJoin(rel: string) {
  const clean = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!clean || clean === ".") return WORK_DIR;
  const abs = resolve(WORK_DIR, clean);
  if (!abs.startsWith(WORK_DIR + sep) && abs !== WORK_DIR) {
    throw new Error("路径越出工作区");
  }
  return abs;
}

function relFromAbs(abs: string) {
  return relative(WORK_DIR, abs).split(sep).join("/");
}

function skipName(name: string) {
  return name === ".git" || name === "node_modules" || name.startsWith(".");
}

export function resetWorkspace(seed: Record<string, string> = SEED_FILES) {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  files.clear();
  for (const [path, content] of Object.entries(seed)) {
    writeRel(path, content, true);
  }
}

function hydrateFromDisk() {
  files.clear();
  if (!existsSync(WORK_DIR)) return;
  const out: string[] = [];
  walk(WORK_DIR, out);
  for (const path of out) {
    try {
      const content = readFileSync(join(WORK_DIR, path), "utf8");
      files.set(path, { path, content, original: content });
    } catch {
      /* skip unreadable */
    }
  }
}

export function ensureWorkspace() {
  if (!existsSync(WORK_DIR)) {
    resetWorkspace();
    return;
  }
  if (files.size === 0) hydrateFromDisk();
  if (files.size === 0) resetWorkspace();
}

/** Drop the in-memory cache — as if the process restarted. Disk files stay. */
export function dropFileCache() {
  files.clear();
}

export function writeRel(path: string, content: string, asOriginal = false) {
  const abs = safeJoin(path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, "utf8");
  const prev = files.get(path);
  files.set(path, {
    path,
    content,
    original: asOriginal ? content : prev ? (prev.original ?? content) : "",
  });
}

export function unlinkRel(path: string) {
  const abs = safeJoin(path);
  if (!existsSync(abs)) {
    files.delete(path);
    return false;
  }
  if (statSync(abs).isDirectory()) {
    throw new Error("不能删除目录");
  }
  rmSync(abs);
  files.delete(path);
  return true;
}

export function readRel(path: string): string {
  const abs = safeJoin(path);
  if (!existsSync(abs) || statSync(abs).isDirectory()) {
    throw new Error(`文件不存在：${path}`);
  }
  const content = readFileSync(abs, "utf8");
  const prev = files.get(path);
  files.set(path, { path, content, original: prev ? prev.original : content });
  return content;
}

export function listRel(path: string) {
  ensureWorkspace();
  const abs = safeJoin(path || ".");
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (!st.isDirectory()) {
    return [{ name: path.split("/").pop() ?? path, path, absolute: abs, type: "file" as const }];
  }
  return readdirSync(abs)
    .filter((name) => !skipName(name))
    .map((name) => {
      const child = join(abs, name);
      const rel = relFromAbs(child);
      const isDir = statSync(child).isDirectory();
      return { name, path: rel, absolute: child, type: isDir ? ("directory" as const) : ("file" as const) };
    })
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1));
}

export function allFilePaths(): string[] {
  ensureWorkspace();
  const out: string[] = [];
  walk(WORK_DIR, out);
  return out.sort();
}

function walk(dir: string, out: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (skipName(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(relFromAbs(abs));
  }
}

export function grep(pattern: string, limit = 80) {
  ensureWorkspace();
  const re = (() => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      return null;
    }
  })();
  const needle = pattern.toLowerCase();
  const hits: { path: string; line_number: number; lines: string }[] = [];
  for (const path of allFilePaths()) {
    let text = "";
    try {
      text = readRel(path);
    } catch {
      continue;
    }
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (hits.length >= limit) return;
      const ok = re ? re.test(line) : line.toLowerCase().includes(needle);
      if (ok) hits.push({ path, line_number: i + 1, lines: line });
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function findFiles(query: string, limit = 80) {
  ensureWorkspace();
  const q = query.trim().toLowerCase();
  return allFilePaths()
    .filter((p) => !q || p.toLowerCase().includes(q))
    .slice(0, limit);
}

export function statusFiles() {
  ensureWorkspace();
  const rows: { path: string; status: string }[] = [];
  for (const path of allFilePaths()) {
    const entry = files.get(path);
    let content = entry?.content;
    try {
      content = readRel(path);
    } catch {
      continue;
    }
    const original = entry?.original ?? content;
    if (!entry || entry.original === "") {
      if (content !== "") rows.push({ path, status: "added" });
    } else if (content !== original) {
      rows.push({ path, status: "modified" });
    }
  }
  return rows;
}

export function snapshotFiles() {
  ensureWorkspace();
  const out: Record<string, { path: string; content: string; original: string }> = {};
  for (const path of allFilePaths()) {
    try {
      const content = readRel(path);
      const orig = files.get(path)?.original ?? content;
      out[path] = { path, content, original: orig };
    } catch {
      /* skip */
    }
  }
  return out;
}

export function projectMeta() {
  ensureWorkspace();
  return {
    id: "local-workspace",
    name: PROJECT_NAME,
    worktree: WORK_DIR,
    sandboxes: [],
  };
}

export function pathMeta() {
  ensureWorkspace();
  return {
    home: WORK_DIR,
    directory: WORK_DIR,
    worktree: WORK_DIR,
    state: WORK_DIR,
  };
}
