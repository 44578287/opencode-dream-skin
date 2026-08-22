import { createServerFn } from "@tanstack/react-start";
import type { SyncBundle } from "./types";

export const hostHealth = createServerFn({ method: "POST" }).handler(async () => {
  const { HOST_VERSION } = await import("./mock");
  return { ok: true as const, version: HOST_VERSION, label: "演示主机" };
});

export const hostPull = createServerFn({ method: "POST" }).handler(async () => {
  const { getHost } = await import("./mock");
  return getHost();
});

export const hostPush = createServerFn({ method: "POST" })
  .validator((input: SyncBundle) => input)
  .handler(async ({ data }) => {
    const { putHost } = await import("./mock");
    return putHost(data);
  });
