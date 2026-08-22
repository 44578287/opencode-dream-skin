import { useMemo, useState } from "react";
import { Check, FileArchive, ImagePlus, Moon, Sun, Upload } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { allThemes, findTheme, useApp } from "@/lib/store";
import { downloadBlob, exportDreamSkinZip, importThemeFiles, importThemeJson, sampleSnippet, swatch } from "@/lib/theme";
import { cn, uid as makeId } from "@/lib/utils";

const SOURCE_LABEL = {
  opencode: "OpenCode",
  marketplace: "市面",
  vscode: "VS Code",
  codex: "Dream Skin",
  custom: "自定义",
} as const;

export function ThemeStudio({ variant = "dialog" }: { variant?: "dialog" | "page" }) {
  const open = useApp((s) => s.themeOpen);
  const setOpen = useApp((s) => s.setThemeOpen);
  const themeId = useApp((s) => s.themeId);
  const appearance = useApp((s) => s.appearance);
  const setTheme = useApp((s) => s.setTheme);
  const setAppearance = useApp((s) => s.setAppearance);
  const addCustomTheme = useApp((s) => s.addCustomTheme);
  const customThemes = useApp((s) => s.customThemes);
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState<string | undefined>();
  const [wallpaperName, setWallpaperName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const themes = allThemes();
  const filtered = themes.filter((t) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${t.name} ${t.origin} ${t.id}`.toLowerCase().includes(q);
  });
  const skins = filtered.filter((t) => t.dreamSkin);
  const rest = filtered.filter((t) => !t.dreamSkin);

  const detected = useMemo(() => {
    if (!paste.trim()) return "";
    const result = importThemeJson(paste);
    return result.ok ? result.format : "unknown";
  }, [paste]);

  function importPaste() {
    const result = importThemeJson(paste);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const pack = result.dreamSkin;
    addCustomTheme({
      id: `custom-${makeId("th")}`,
      name: result.name,
      source: result.source,
      origin: pack ? "imported · Dream Skin" : `imported · ${result.format}`,
      appearance: pack?.appearance === "light" ? "light" : pack?.appearance === "auto" ? "both" : pack ? "dark" : "both",
      file: result.file,
      dreamSkin: pack,
      wallpaper,
    });
    setNotice(pack ? `已转换 Dream Skin「${result.name}」${wallpaper ? "，壁纸已挂上" : ""}。` : `已接入 ${result.format} 主题「${result.name}」。`);
    setPaste("");
    setWallpaper(undefined);
    setWallpaperName(null);
  }

  async function importFiles(list: FileList | File[] | null) {
    const files = list ? [...list] : [];
    if (!files.length) {
      setDragging(false);
      return;
    }
    setBusy(true);
    setDragging(false);
    setNotice(null);
    try {
      const result = await importThemeFiles(files);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      addCustomTheme(result.entry);
      const extra = result.warnings.length ? ` · ${result.warnings.join(" ")}` : "";
      setNotice(`已装上主题包「${result.entry.name}」${extra}`);
      setPaste("");
      setWallpaper(undefined);
      setWallpaperName(null);
    } finally {
      setBusy(false);
    }
  }

  function onWallpaper(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaper(typeof reader.result === "string" ? reader.result : undefined);
      setWallpaperName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function exportZip() {
    const { filename, blob } = await exportDreamSkinZip(findTheme(themeId));
    downloadBlob(blob, filename);
    setNotice(`已导出 Dream Skin 包 ${filename}`);
  }

  const body = (
    <div className={cn("flex flex-col", variant === "page" ? "h-full min-h-0" : "max-h-[min(80vh,680px)]")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 Gothic、夜雨、Tokyo Night…" className="max-w-xs" />
        <div className="flex rounded-full bg-element p-0.5">
          <button type="button" onClick={() => setAppearance("dark")} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]", appearance === "dark" ? "bg-background text-foreground" : "text-muted")}>
            <Moon className="size-3" /> 暗色
          </button>
          <button type="button" onClick={() => setAppearance("light")} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]", appearance === "light" ? "bg-background text-foreground" : "text-muted")}>
            <Sun className="size-3" /> 亮色
          </button>
        </div>
        <p className="text-[11px] text-muted">ZIP 进 · ZIP 出 · 与主机同步</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {skins.length ? (
          <section className="p-4 pb-2">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">Dream Skin</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {skins.map((theme) => {
                const active = theme.id === themeId;
                const fx = theme.dreamSkin?.art?.focusX ?? 0.76;
                const fy = theme.dreamSkin?.art?.focusY ?? 0.45;
                return (
                  <button key={theme.id} type="button" onClick={() => setTheme(theme.id)} className={cn("overflow-hidden rounded-md border text-left transition-colors duration-150", active ? "border-border-active" : "border-border hover:border-border-active")}>
                    <div className="relative h-24 overflow-hidden">
                      {theme.wallpaper ? (
                        <img src={theme.wallpaper} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${Math.round(fx * 100)}% ${Math.round(fy * 100)}%` }} />
                      ) : (
                        <SwatchRow file={theme.file} appearance={appearance} />
                      )}
                      {active ? <Check className="absolute right-2 top-2 size-4 text-primary" /> : null}
                    </div>
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{theme.name}</span>
                        <Badge tone={active ? "primary" : "muted"}>{SOURCE_LABEL[theme.source]}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{theme.dreamSkin?.tagline ?? theme.origin}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        {rest.length ? (
          <section className="p-4 pt-2">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">OpenCode / 市面色板</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rest.map((theme) => {
                const active = theme.id === themeId;
                return (
                  <button key={theme.id} type="button" onClick={() => setTheme(theme.id)} className={cn("rounded-md border p-3 text-left transition-colors duration-150", active ? "border-border-active bg-element" : "border-border hover:bg-element/50")}>
                    <SwatchRow file={theme.file} appearance={appearance} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{theme.name}</span>
                      {active ? <Check className="size-4 text-primary" /> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge>{SOURCE_LABEL[theme.source]}</Badge>
                      <span className="truncate text-[11px] text-muted">{theme.origin}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        <div className="border-t border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Upload className="size-4 text-muted" />
            <p className="text-sm font-medium">丢主题包</p>
            {detected ? <Badge tone={detected === "unknown" ? "warning" : "primary"}>{detected === "unknown" ? "未识别" : detected}</Badge> : null}
          </div>
          <label
            className={cn("flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-5 text-center transition-colors duration-150", dragging ? "border-border-active bg-element" : "border-border hover:border-border-active hover:bg-element/40", busy ? "pointer-events-none opacity-60" : "")}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={(e) => { e.preventDefault(); void importFiles(e.dataTransfer.files); }}
          >
            <FileArchive className="size-6 text-primary" />
            <p className="text-sm font-medium">{busy ? "正在解包…" : "把 Dream Skin ZIP 拖到这里"}</p>
            <p className="max-w-md text-[11px] text-muted text-pretty">正式包：theme.json + background.jpg/png/webp + 可选 theme.css。</p>
            <input type="file" multiple accept=".zip,application/zip,.json,.css,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <p className="mt-3 mb-2 text-xs text-muted">没有 ZIP 时，也可以只贴 theme.json，再另附壁纸。</p>
          <textarea value={paste} onChange={(e) => { setPaste(e.target.value); setNotice(null); }} rows={5} placeholder={sampleSnippet("dreamskin")} className="w-full rounded-sm border border-border bg-background p-2 font-mono text-[11px] text-foreground placeholder:text-muted focus:outline-none" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={importPaste} disabled={!paste.trim()}>写入工作台</Button>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-xs text-muted hover:bg-element hover:text-foreground">
              <ImagePlus className="size-3.5" />
              {wallpaperName ?? "附上壁纸"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onWallpaper(e.target.files?.[0])} />
            </label>
            <Button size="sm" variant="ghost" onClick={() => setPaste(sampleSnippet("dreamskin"))}>Dream Skin 示例</Button>
            <Button size="sm" variant="ghost" onClick={() => setPaste(sampleSnippet("vscode"))}>VS Code 示例</Button>
            <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([JSON.stringify(findTheme(themeId).file, null, 2)], { type: "application/json" }), `${themeId}.json`)}>导出 OpenCode JSON</Button>
            <Button size="sm" variant="ghost" onClick={() => void exportZip()}>导出 Dream Skin ZIP</Button>
          </div>
          {notice ? <p className="mt-2 text-xs text-accent">{notice}</p> : null}
          {customThemes.length ? <p className="mt-2 text-[11px] text-muted">{customThemes.length} 个自定义主题保存在本机。</p> : null}
        </div>
      </ScrollArea>
    </div>
  );

  if (variant === "page") return body;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="主题工作室" className="max-h-[min(88vh,720px)] overflow-hidden p-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none">
        {body}
      </DialogContent>
    </Dialog>
  );
}

function SwatchRow({ file, appearance }: { file: ReturnType<typeof findTheme>["file"]; appearance: "dark" | "light" }) {
  const colors = swatch(file, appearance);
  return (
    <div className="flex h-8 overflow-hidden rounded-sm">
      {colors.map((c, i) => (
        <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}
