import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "./utils";
import type { VFile } from "./workspace";
import { DEFAULT_THEME_ID, DREAM_SKIN_CATALOG, THEME_CATALOG, type Appearance, type CatalogEntry, type OpenCodeThemeFile } from "./theme";
import {
  DEFAULT_CONNECTION,
  DEFAULT_SYNC_FLAGS,
  type Connection,
  type HostHealth,
  type HostModel,
  type SearchHit,
  type SyncBundle,
  type SyncFlags,
} from "./remote/types";
import type { PermissionRequest, QuestionRequest } from "./remote/events";

export type AgentMode = "build" | "plan";
export type RailId = "sessions" | "files" | "search" | "git";
export type RightView = "editor" | "diff";
export type MobileTab = "chat" | "workspace" | "link" | "skin";

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, string>;
  result?: string;
  status: "running" | "ok" | "error";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tools?: ToolCall[];
  streaming?: boolean;
  createdAt: number;
};

export type Session = {
  id: string;
  title: string;
  mode: AgentMode;
  model: string;
  status: "idle" | "running" | "error";
  messages: ChatMessage[];
  updatedAt: number;
};

export type CustomTheme = CatalogEntry;

export const MODELS = [
  { id: "grok-4.5", label: "Grok 4.5", hint: "xAI · 默认" },
] as const;

const SEED_VERSION = 7;

function bump(set: (partial: Partial<AppState>) => void, extra: Partial<AppState> = {}) {
  set({ localRevisedAt: Date.now(), ...extra });
}

type AppState = {
  seedVersion: number;
  themeId: string;
  appearance: Appearance;
  customThemes: CustomTheme[];
  sessions: Session[];
  activeSessionId: string;
  files: Record<string, VFile>;
  openFile: string;
  rail: RailId;
  rightView: RightView;
  commandOpen: boolean;
  themeOpen: boolean;
  settingsOpen: boolean;
  terminalOpen: boolean;
  mobileTab: MobileTab;
  searchQuery: string;
  searchHits: SearchHit[];
  fileStatus: { path: string; status: string }[];
  connection: Connection;
  syncFlags: SyncFlags;
  host: HostHealth | null;
  hostModels: HostModel[];
  projectName: string;
  projectBranch: string;
  lastSyncAt: number | null;
  lastSyncNote: string | null;
  localRevisedAt: number;
  syncing: boolean;
  live: { connected: boolean; lastEventAt: number | null; lastEventType: string | null };
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  setTheme: (id: string) => void;
  setAppearance: (a: Appearance) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  setRail: (rail: RailId) => void;
  setRightView: (view: RightView) => void;
  setMobileTab: (tab: MobileTab) => void;
  setCommandOpen: (open: boolean) => void;
  setThemeOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchHits: (hits: SearchHit[]) => void;
  setFileStatus: (rows: { path: string; status: string }[]) => void;
  setOpenFile: (path: string) => void;
  setFileContent: (path: string, content: string) => void;
  applyFiles: (next: Record<string, VFile>) => void;
  upsertFile: (file: VFile) => void;
  setActiveSession: (id: string) => void;
  newSession: () => Session;
  closeSession: (id: string) => void;
  applySessions: (sessions: Session[], activeSessionId?: string) => void;
  patchSession: (id: string, patch: Partial<Session>) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
  replaceMessage: (sessionId: string, message: ChatMessage) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  appendDelta: (sessionId: string, messageId: string, delta: string) => void;
  upsertTool: (sessionId: string, messageId: string, tool: ToolCall) => void;
  hydrateSession: (session: Session) => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  finishStreaming: (sessionId: string) => void;
  setLive: (patch: Partial<AppState["live"]>) => void;
  upsertPermission: (request: PermissionRequest) => void;
  removePermission: (id: string) => void;
  upsertQuestion: (request: QuestionRequest) => void;
  removeQuestion: (id: string) => void;
  setMode: (mode: AgentMode) => void;
  setModel: (model: string) => void;
  setConnection: (patch: Partial<Connection>) => void;
  setSyncFlags: (patch: Partial<SyncFlags>) => void;
  setHost: (host: HostHealth | null) => void;
  setHostModels: (models: HostModel[]) => void;
  setProjectMeta: (name: string, branch: string) => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: (note: string) => void;
  applyBundle: (bundle: SyncBundle) => void;
  snapshot: () => SyncBundle;
  touch: () => void;
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      seedVersion: SEED_VERSION,
      themeId: DEFAULT_THEME_ID,
      appearance: "dark",
      customThemes: [],
      sessions: [],
      activeSessionId: "",
      files: {},
      openFile: "",
      rail: "sessions",
      rightView: "editor",
      commandOpen: false,
      themeOpen: false,
      settingsOpen: false,
      terminalOpen: false,
      mobileTab: "chat",
      searchQuery: "",
      searchHits: [],
      fileStatus: [],
      connection: DEFAULT_CONNECTION,
      syncFlags: DEFAULT_SYNC_FLAGS,
      host: null,
      hostModels: [],
      projectName: "workspace",
      projectBranch: "main",
      lastSyncAt: null,
      lastSyncNote: null,
      localRevisedAt: Date.now(),
      syncing: false,
      live: { connected: false, lastEventAt: null, lastEventType: null },
      permissions: [],
      questions: [],
      setTheme: (id) => {
        const catalog = [...get().customThemes, ...DREAM_SKIN_CATALOG, ...THEME_CATALOG];
        const next = catalog.find((t) => t.id === id);
        if (!next) {
          bump(set, { themeId: id });
          return;
        }
        if (next.appearance === "dark") bump(set, { themeId: id, appearance: "dark" });
        else if (next.appearance === "light") bump(set, { themeId: id, appearance: "light" });
        else bump(set, { themeId: id });
      },
      setAppearance: (appearance) => bump(set, { appearance }),
      addCustomTheme: (theme) => {
        const next: Partial<AppState> = {
          customThemes: [theme, ...get().customThemes.filter((t) => t.id !== theme.id)],
          themeId: theme.id,
        };
        if (theme.appearance === "dark") next.appearance = "dark";
        else if (theme.appearance === "light") next.appearance = "light";
        bump(set, next);
      },
      setRail: (rail) => set({ rail }),
      setRightView: (rightView) => set({ rightView }),
      setMobileTab: (mobileTab) => set({ mobileTab }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setThemeOpen: (themeOpen) => set({ themeOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSearchHits: (searchHits) => set({ searchHits }),
      setFileStatus: (fileStatus) => set({ fileStatus }),
      setOpenFile: (openFile) => set({ openFile, rightView: "editor" }),
      setFileContent: (path, content) =>
        bump(set, {
          files: { ...get().files, [path]: { ...get().files[path], path, content, original: get().files[path]?.original ?? content } },
        }),
      applyFiles: (next) => bump(set, { files: next }),
      upsertFile: (file) => bump(set, { files: { ...get().files, [file.path]: file } }),
      setActiveSession: (activeSessionId) => set({ activeSessionId }),
      newSession: () => {
        const session: Session = {
          id: uid("sess"),
          title: "新会话",
          mode: get().sessions.find((s) => s.id === get().activeSessionId)?.mode ?? "build",
          model: get().sessions.find((s) => s.id === get().activeSessionId)?.model ?? get().hostModels[0]?.id ?? "grok-4.5",
          status: "idle",
          messages: [],
          updatedAt: Date.now(),
        };
        bump(set, { sessions: [session, ...get().sessions], activeSessionId: session.id });
        return session;
      },
      closeSession: (id) => {
        const sessions = get().sessions.filter((s) => s.id !== id);
        const activeSessionId = get().activeSessionId === id ? (sessions[0]?.id ?? "") : get().activeSessionId;
        bump(set, { sessions, activeSessionId });
      },
      applySessions: (sessions, activeSessionId) =>
        set({
          sessions,
          activeSessionId: activeSessionId ?? get().activeSessionId ?? sessions[0]?.id ?? "",
        }),
      patchSession: (id, patch) =>
        bump(set, {
          sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
        }),
      appendMessage: (sessionId, message) =>
        bump(set, {
          sessions: get().sessions.map((s) =>
            s.id === sessionId ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() } : s,
          ),
        }),
      replaceMessage: (sessionId, message) =>
        bump(set, {
          sessions: get().sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map((m) => (m.id === message.id ? message : m)), updatedAt: Date.now() }
              : s,
          ),
        }),
      removeMessage: (sessionId, messageId) =>
        bump(set, {
          sessions: get().sessions.map((s) =>
            s.id === sessionId ? { ...s, messages: s.messages.filter((m) => m.id !== messageId) } : s,
          ),
        }),
      appendDelta: (sessionId, messageId, delta) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const has = sess.messages.some((m) => m.id === messageId);
            const messages = has
              ? sess.messages.map((m) => (m.id === messageId ? { ...m, content: `${m.content}${delta}`, streaming: true, role: m.role || "assistant" } : m))
              : [...sess.messages, { id: messageId, role: "assistant" as const, content: delta, streaming: true, createdAt: Date.now() }];
            return { ...sess, messages, status: "running" as const, updatedAt: Date.now() };
          }),
        })),
      upsertTool: (sessionId, messageId, tool) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const existing = sess.messages.find((m) => m.id === messageId);
            if (!existing) {
              return {
                ...sess,
                messages: [
                  ...sess.messages,
                  { id: messageId, role: "assistant" as const, content: "", tools: [tool], streaming: true, createdAt: Date.now() },
                ],
                status: "running" as const,
                updatedAt: Date.now(),
              };
            }
            const tools = existing.tools?.some((t) => t.id === tool.id)
              ? existing.tools.map((t) => (t.id === tool.id ? tool : t))
              : [...(existing.tools ?? []), tool];
            return {
              ...sess,
              messages: sess.messages.map((m) => (m.id === messageId ? { ...m, tools } : m)),
              updatedAt: Date.now(),
            };
          }),
        })),
      hydrateSession: (session) =>
        set((s) => {
          if (s.sessions.some((x) => x.id === session.id)) {
            return { sessions: s.sessions.map((x) => (x.id === session.id ? { ...x, ...session, messages: session.messages.length ? session.messages : x.messages } : x)) };
          }
          return { sessions: [session, ...s.sessions], activeSessionId: s.activeSessionId || session.id };
        }),
      setSessionMessages: (sessionId, messages) =>
        set((s) => ({
          sessions: s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, messages } : sess)),
        })),
      finishStreaming: (sessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId
              ? { ...sess, status: "idle", messages: sess.messages.map((m) => ({ ...m, streaming: false })), updatedAt: Date.now() }
              : sess,
          ),
        })),
      setLive: (patch) => set((s) => ({ live: { ...s.live, ...patch } })),
      upsertPermission: (request) =>
        set((s) => ({
          permissions: s.permissions.some((p) => p.id === request.id)
            ? s.permissions.map((p) => (p.id === request.id ? request : p))
            : [...s.permissions, request],
        })),
      removePermission: (id) => set((s) => ({ permissions: s.permissions.filter((p) => p.id !== id) })),
      upsertQuestion: (request) =>
        set((s) => ({
          questions: s.questions.some((q) => q.id === request.id)
            ? s.questions.map((q) => (q.id === request.id ? request : q))
            : [...s.questions, request],
        })),
      removeQuestion: (id) => set((s) => ({ questions: s.questions.filter((q) => q.id !== id) })),
      setMode: (mode) => {
        const id = get().activeSessionId;
        bump(set, { sessions: get().sessions.map((s) => (s.id === id ? { ...s, mode } : s)) });
      },
      setModel: (model) => {
        const id = get().activeSessionId;
        bump(set, { sessions: get().sessions.map((s) => (s.id === id ? { ...s, model } : s)) });
      },
      setConnection: (patch) => set({ connection: { ...get().connection, ...patch } }),
      setSyncFlags: (patch) => set({ syncFlags: { ...get().syncFlags, ...patch } }),
      setHost: (host) => set({ host }),
      setHostModels: (hostModels) => set({ hostModels }),
      setProjectMeta: (projectName, projectBranch) => set({ projectName, projectBranch }),
      setSyncing: (syncing) => set({ syncing }),
      markSynced: (note) => set({ lastSyncAt: Date.now(), lastSyncNote: note, syncing: false }),
      applyBundle: (bundle) =>
        set({
          themeId: bundle.themeId || get().themeId,
          appearance: bundle.appearance || get().appearance,
          customThemes: bundle.customThemes ?? get().customThemes,
          sessions: (bundle.sessions as Session[]) || get().sessions,
          activeSessionId: bundle.activeSessionId || get().activeSessionId,
          files: bundle.files && Object.keys(bundle.files).length ? bundle.files : get().files,
          localRevisedAt: bundle.updatedAt,
        }),
      snapshot: () => ({
        version: 1,
        updatedAt: get().localRevisedAt,
        themeId: get().themeId,
        appearance: get().appearance,
        customThemes: get().customThemes,
        sessions: get().sessions,
        activeSessionId: get().activeSessionId,
        files: get().files,
      }),
      touch: () => bump(set),
    }),
    {
      name: "opencode-desktop-v9",
      partialize: (s) => ({
        themeId: s.themeId,
        appearance: s.appearance,
        customThemes: s.customThemes,
        connection: {
          kind: s.connection.kind,
          url: s.connection.url,
          username: s.connection.username,
          password: s.connection.kind === "remote" ? s.connection.password : "",
        },
        syncFlags: s.syncFlags,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> & { connection?: Connection & { kind?: string } } | undefined;
        if (!p) return current;
        let kind = (p.connection?.kind as string | undefined) ?? current.connection.kind;
        if (kind === "demo") kind = "local";
        if (kind !== "offline" && kind !== "local" && kind !== "remote") kind = "offline";
        return {
          ...current,
          themeId: p.themeId ?? current.themeId,
          appearance: p.appearance ?? current.appearance,
          customThemes: p.customThemes ?? current.customThemes,
          connection: {
            ...current.connection,
            ...p.connection,
            kind: kind as Connection["kind"],
            password: kind === "remote" ? (p.connection?.password ?? "") : "",
          },
          syncFlags: p.syncFlags ?? current.syncFlags,
        };
      },
    },
  ),
);

export function allThemes(): CatalogEntry[] {
  const custom = useApp.getState().customThemes;
  return [...custom, ...DREAM_SKIN_CATALOG, ...THEME_CATALOG];
}

export function findTheme(id: string): CatalogEntry {
  return allThemes().find((t) => t.id === id) ?? DREAM_SKIN_CATALOG[0];
}

export function fileFromCatalog(id: string): OpenCodeThemeFile {
  return findTheme(id).file;
}
