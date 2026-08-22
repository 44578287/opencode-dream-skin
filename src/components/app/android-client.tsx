import { useEffect, useState } from "react";
import { Bell, Download, Github, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  enableNotifications,
  isStandaloneClient,
  notificationSupport,
  sendTestNotification,
  type NotifyPermission,
} from "@/lib/notify";
import {
  fetchLatestApk,
  GITHUB_ACTIONS_URL,
  GITHUB_RELEASES_URL,
  type ApkRelease,
} from "@/lib/github-release";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function AndroidClientCard() {
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [perm, setPerm] = useState<NotifyPermission>("default");
  const [busy, setBusy] = useState(false);
  const [apk, setApk] = useState<ApkRelease | null>(null);

  useEffect(() => {
    setInstalled(isStandaloneClient());
    setPerm(notificationSupport());
    function onPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    void fetchLatestApk().then(setApk);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setInstallEvent(null);
    }
  }

  async function openNotify() {
    setBusy(true);
    const next = await enableNotifications();
    setPerm(next);
    if (next === "granted") await sendTestNotification();
    setBusy(false);
  }

  return (
    <div className="rounded-md border border-border bg-panel/70 p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-primary" />
        <p className="text-sm font-medium">安卓客户端</p>
        <Badge tone={installed ? "success" : "muted"}>{installed ? "已安装" : "可安装"}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        GitHub Actions 会同时编网页本体和 APK。装 APK 或加到主屏幕都能当客户端跑，权限和提问走系统通知。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <a href={apk?.url ?? GITHUB_RELEASES_URL} target="_blank" rel="noreferrer">
            <Download className="size-3.5" />
            {apk ? `下载 APK${apk.sizeLabel ? ` · ${apk.sizeLabel}` : ""}` : "下载 APK"}
          </a>
        </Button>
        <Button size="sm" variant="secondary" asChild>
          <a href={GITHUB_ACTIONS_URL} target="_blank" rel="noreferrer">
            <Github className="size-3.5" />
            构建记录
          </a>
        </Button>
        {installed ? null : installEvent ? (
          <Button size="sm" variant="outline" onClick={() => void install()}>
            安装到主屏幕
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={perm === "granted" ? "secondary" : "outline"}
          onClick={() => void openNotify()}
          disabled={busy || perm === "unsupported"}
        >
          <Bell className="size-3.5" />
          {perm === "granted"
            ? "通知已开"
            : perm === "denied"
              ? "通知被关"
              : perm === "unsupported"
                ? "不支持通知"
                : "打开系统通知"}
        </Button>
      </div>
      {apk ? (
        <p className="mt-2 text-[11px] text-muted">
          当前构建 {apk.tag} · {apk.name}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted">
          第一次推到 GitHub 后，工作流会产出 APK。用 Chrome 也可在菜单里「添加到主屏幕」。
        </p>
      )}
      {perm === "denied" ? (
        <p className="mt-2 text-[11px] text-muted">系统里把这个应用的通知打开后才会进通知栏。</p>
      ) : null}
    </div>
  );
}
