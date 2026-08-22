import type { CatalogEntry } from "@/lib/theme";
import type { VFile } from "@/lib/workspace";
import type { SyncBundle, SyncFlags, SyncSession } from "./types";

export type MergeResult = {
  bundle: SyncBundle;
  notes: string[];
};

function unionSessions(local: SyncSession[], remote: SyncSession[]): { next: SyncSession[]; added: number; updated: number } {
  const map = new Map<string, SyncSession>();
  for (const s of local) map.set(s.id, s);
  let added = 0;
  let updated = 0;
  for (const s of remote) {
    const prev = map.get(s.id);
    if (!prev) {
      map.set(s.id, s);
      added += 1;
    } else if (s.updatedAt > prev.updatedAt) {
      map.set(s.id, s);
      updated += 1;
    }
  }
  return { next: [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt), added, updated };
}

function slimThemes(themes: CatalogEntry[]): CatalogEntry[] {
  return themes.map((t) => {
    if (t.wallpaper && t.wallpaper.length > 420_000) {
      const { wallpaper: _drop, ...rest } = t;
      return rest;
    }
    return t;
  });
}

export function mergeBundles(local: SyncBundle, remote: SyncBundle, flags: SyncFlags): MergeResult {
  const notes: string[] = [];
  const remoteNewer = remote.updatedAt >= local.updatedAt;
  let themeId = local.themeId;
  let appearance = local.appearance;
  let customThemes = local.customThemes;
  if (flags.theme && remoteNewer) {
    themeId = remote.themeId || local.themeId;
    appearance = remote.appearance || local.appearance;
    const incoming = slimThemes(remote.customThemes ?? []);
    if (incoming.length) {
      const ids = new Set(incoming.map((t) => t.id));
      customThemes = [...incoming, ...local.customThemes.filter((t) => !ids.has(t.id))];
    }
    if (themeId !== local.themeId) notes.push(`主题同步为「${themeId}」`);
  }

  let sessions = local.sessions;
  let activeSessionId = local.activeSessionId;
  if (flags.sessions) {
    const union = unionSessions(local.sessions, remote.sessions ?? []);
    sessions = union.next;
    if (union.added) notes.push(`同步了 ${union.added} 个新会话`);
    if (union.updated) notes.push(`更新了 ${union.updated} 个会话`);
    if (remoteNewer && remote.activeSessionId && sessions.some((s) => s.id === remote.activeSessionId)) {
      activeSessionId = remote.activeSessionId;
    }
  }

  let files = local.files;
  if (flags.files && remoteNewer && remote.files && Object.keys(remote.files).length) {
    files = { ...local.files, ...remote.files };
    notes.push("工作区文件已与主机对齐");
  }

  if (!notes.length) notes.push("已与主机对齐，没有新的变更");

  return {
    bundle: {
      version: 1,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      themeId,
      appearance,
      customThemes,
      sessions,
      activeSessionId,
      files,
    },
    notes,
  };
}

export function slimBundle(bundle: SyncBundle, flags: SyncFlags): SyncBundle {
  return {
    ...bundle,
    customThemes: flags.theme ? slimThemes(bundle.customThemes) : [],
    sessions: flags.sessions ? bundle.sessions : [],
    files: flags.files ? bundle.files : {},
  };
}

export function fileFingerprint(files: Record<string, VFile>) {
  return Object.keys(files)
    .sort()
    .map((path) => `${path}:${files[path]?.content.length ?? 0}`)
    .join("|");
}
