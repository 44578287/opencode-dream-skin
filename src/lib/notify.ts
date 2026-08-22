import type { HostEvent } from "./remote/events";

const ICON = "/__grok/icon-180.png";
export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

let registration: ServiceWorkerRegistration | null = null;

export function notificationSupport(): NotifyPermission {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return Notification.permission as NotifyPermission;
}

export function isStandaloneClient() {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export async function registerNotifyWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

export async function enableNotifications(): Promise<NotifyPermission> {
  const current = notificationSupport();
  if (current === "unsupported") return current;
  await registerNotifyWorker();
  if (current === "granted") return "granted";
  try {
    const next = await Notification.requestPermission();
    return next as NotifyPermission;
  } catch {
    return "denied";
  }
}

export async function showSystemNotification(input: {
  title: string;
  body: string;
  tag?: string;
  sessionID?: string;
  kind?: string;
}) {
  if (notificationSupport() !== "granted") return;
  const options = {
    body: input.body,
    tag: input.tag ?? "opencode",
    icon: ICON,
    badge: ICON,
    lang: "zh-CN",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { sessionID: input.sessionID, kind: input.kind },
  } as NotificationOptions;
  const ready = registration ?? (await navigator.serviceWorker.getRegistration("/"));
  if (ready?.active) {
    ready.active.postMessage({ type: "notify", title: input.title, options });
    return;
  }
  try {
    new Notification(input.title, options);
  } catch {
    /* ignore */
  }
}

export function notifyHostEvent(event: HostEvent) {
  switch (event.type) {
    case "permission.asked":
      void showSystemNotification({
        title: `主机要权限 · ${event.properties.permission}`,
        body: event.properties.patterns[0] ?? "点开后允许或拒绝",
        tag: `perm-${event.properties.id}`,
        sessionID: event.properties.sessionID,
        kind: "permission",
      });
      return;
    case "question.asked": {
      const q = event.properties.questions[0];
      void showSystemNotification({
        title: q?.header ? `主机提问 · ${q.header}` : "主机在提问",
        body: q?.question ?? "点开后选择",
        tag: `que-${event.properties.id}`,
        sessionID: event.properties.sessionID,
        kind: "question",
      });
      return;
    }
    case "session.error":
      void showSystemNotification({
        title: "会话出错",
        body: event.properties.error?.message ?? "主机报错了，点开查看",
        tag: `err-${event.properties.sessionID}`,
        sessionID: event.properties.sessionID,
        kind: "error",
      });
      return;
    default:
      return;
  }
}

export async function sendTestNotification() {
  await showSystemNotification({
    title: "OpenCode 通知已打开",
    body: "权限、提问和报错会进系统通知栏。",
    tag: "opencode-test",
    kind: "test",
  });
}
