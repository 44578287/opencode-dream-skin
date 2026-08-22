import type { Appearance, CatalogEntry } from "@/lib/theme";
import type { VFile } from "@/lib/workspace";

export type ConnectionKind = "offline" | "demo" | "remote";

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
  kind: "demo",
  url: "",
  username: "opencode",
  password: "",
};

export const DEFAULT_SYNC_FLAGS: SyncFlags = {
  theme: true,
  sessions: true,
  files: true,
};
