import type { Appearance, CatalogEntry } from "@/lib/theme";
import type { VFile } from "@/lib/workspace";

export type ConnectionKind = "offline" | "local" | "remote";

export type Connection = {
  kind: ConnectionKind;
  url: string;
  username: string;
  password: string;
};

export type SyncFlags = {
  theme: boolean;
  sessions: boolean;
  files: boolean;
};

export type HostModel = {
  id: string;
  label: string;
  provider: string;
};

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  ignored?: boolean;
};

export type SearchHit = {
  path: string;
  line: number;
  text: string;
};

export type SyncSession = {
  id: string;
  title: string;
  mode: "build" | "plan";
  model: string;
  status: "idle" | "running" | "error";
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    tools?: Array<{
      id: string;
      name: string;
      args: Record<string, string>;
      result?: string;
      status: "running" | "ok" | "error";
    }>;
    createdAt: number;
  }>;
  updatedAt: number;
};

export type SyncBundle = {
  version: 1;
  updatedAt: number;
  themeId: string;
  appearance: Appearance;
  customThemes: CatalogEntry[];
  sessions: SyncSession[];
  activeSessionId: string;
  files: Record<string, VFile>;
};

export type HostHealth = {
  ok: boolean;
  kind: ConnectionKind;
  version: string;
  label: string;
  error?: string;
};

export const DEFAULT_CONNECTION: Connection = {
  kind: "local",
  url: "",
  username: "opencode",
  password: "",
};

export const DEFAULT_SYNC_FLAGS: SyncFlags = {
  theme: true,
  sessions: true,
  files: true,
};

export function isNativeShell() {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.() || cap) return true;
  try {
    const u = new URL(window.location.href);
    return u.protocol === "https:" && u.hostname === "localhost" && u.port === "";
  } catch {
    return false;
  }
}

export function localBase(): string {
  if (typeof window === "undefined") return "/api/oc";
  return `${window.location.origin}/api/oc`;
}

export function hostBase(conn: Connection): string {
  if (conn.kind === "offline") return "";
  if (conn.kind === "local") return localBase();
  return conn.url.trim().replace(/\/+$/, "");
}

export function splitModel(id?: string): { providerID: string; modelID: string } | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const i = trimmed.indexOf("/");
  if (i <= 0) return { providerID: "opencode", modelID: trimmed };
  return { providerID: trimmed.slice(0, i), modelID: trimmed.slice(i + 1) };
}

export function modelKey(provider: string, model: string) {
  if (!provider) return model;
  if (model.startsWith(`${provider}/`)) return model;
  return `${provider}/${model}`;
}

