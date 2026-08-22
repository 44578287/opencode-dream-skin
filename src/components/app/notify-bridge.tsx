import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { registerNotifyWorker, notificationSupport } from "@/lib/notify";

export function NotifyBridge() {
  const setActive = useApp((s) => s.setActiveSession);
  const setMobileTab = useApp((s) => s.setMobileTab);
  const setRail = useApp((s) => s.setRail);

  useEffect(() => {
    if (notificationSupport() === "granted") void registerNotifyWorker();

    function openPayload(payload: { sessionID?: string; kind?: string } | undefined) {
      if (!payload?.sessionID) return;
      setActive(payload.sessionID);
      setMobileTab("chat");
      setRail("sessions");
    }

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "notify-open") return;
      openPayload(event.data.payload);
    }

    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [setActive, setMobileTab, setRail]);

  return null;
}
