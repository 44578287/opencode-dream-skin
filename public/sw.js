/* OpenCode remote client — notification worker for Android / installed PWA */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "notify") return;
  const title = String(data.title || "OpenCode");
  const options = data.options && typeof data.options === "object" ? data.options : {};
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  event.waitUntil(openClient(payload));
});

async function openClient(payload) {
  const origin = self.location.origin;
  const url = origin + "/";
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of all) {
    if (client.url.startsWith(origin)) {
      await client.focus();
      client.postMessage({ type: "notify-open", payload });
      return;
    }
  }
  const opened = await self.clients.openWindow(url);
  if (opened) opened.postMessage({ type: "notify-open", payload });
}
