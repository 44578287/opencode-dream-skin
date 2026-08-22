import type { SyncBundle } from "./types";
import { seedFiles } from "@/lib/workspace";

const now = Date.now();

const HOST_SESSION = {
  id: "sess-host-brief",
  title: "远端：给 README 补一行",
  mode: "plan" as const,
  model: "grok-4.5",
  status: "idle" as const,
  updatedAt: now - 1000 * 60 * 4,
  messages: [
    {
      id: "hm1",
      role: "user" as const,
      content: "README 里加一句远程客户端怎么连。",
      createdAt: now - 1000 * 60 * 5,
    },
    {
      id: "hm2",
      role: "assistant" as const,
      content: "可以。连上主机后主题、会话和工作区会双向同步；手机端走 Dream Skin 外壳。",
      createdAt: now - 1000 * 60 * 4,
    },
  ],
};

function seed(): SyncBundle {
  const files = seedFiles();
  return {
    version: 1,
    updatedAt: now - 1000 * 30,
    themeId: "preset-gothic-void-crusade",
    appearance: "dark",
    customThemes: [],
    sessions: [HOST_SESSION],
    activeSessionId: HOST_SESSION.id,
    files,
  };
}

let host: SyncBundle = seed();

export function getHost(): SyncBundle {
  return host;
}

export function putHost(next: SyncBundle) {
  host = { ...next, version: 1, updatedAt: Date.now() };
  return host;
}

export function resetHost() {
  host = seed();
  return host;
}

export const HOST_VERSION = "demo-1";
