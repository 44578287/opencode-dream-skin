import { Command } from "cmdk";
import {
  FileCode2,
  Hammer,
  Map,
  Moon,
  Palette,
  Plus,
  Sun,
  Terminal,
} from "lucide-react";
import { allThemes, useApp } from "@/lib/store";

export function CommandPalette() {
  const open = useApp((s) => s.commandOpen);
  const setOpen = useApp((s) => s.setCommandOpen);
  const files = useApp((s) => s.files);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const newSession = useApp((s) => s.newSession);
  const setMode = useApp((s) => s.setMode);
  const setThemeOpen = useApp((s) => s.setThemeOpen);
  const setTheme = useApp((s) => s.setTheme);
  const setAppearance = useApp((s) => s.setAppearance);
  const setTerminalOpen = useApp((s) => s.setTerminalOpen);
  const terminalOpen = useApp((s) => s.terminalOpen);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/50 px-3 pt-[12vh]" onClick={() => setOpen(false)}>
      <Command
        className="ds-command w-full max-w-lg overflow-hidden rounded-md border border-border bg-panel shadow-window"
        data-ds-part="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <Command.Input
          autoFocus
          placeholder="搜索命令、文件、主题…"
          className="h-11 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-80 overflow-auto p-1">
          <Command.Empty className="px-3 py-6 text-center text-xs text-muted">没有匹配</Command.Empty>
          <Command.Group heading="工作台" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
            <Item icon={Plus} label="新会话" onSelect={() => { newSession(); setOpen(false); }} />
            <Item icon={Hammer} label="切换到构建模式" onSelect={() => { setMode("build"); setOpen(false); }} />
            <Item icon={Map} label="切换到规划模式" onSelect={() => { setMode("plan"); setOpen(false); }} />
            <Item icon={Palette} label="打开主题工作室" onSelect={() => { setThemeOpen(true); setOpen(false); }} />
            <Item icon={Terminal} label={terminalOpen ? "隐藏终端" : "显示终端"} onSelect={() => { setTerminalOpen(!terminalOpen); setOpen(false); }} />
            <Item icon={Moon} label="暗色外观" onSelect={() => { setAppearance("dark"); setOpen(false); }} />
            <Item icon={Sun} label="亮色外观" onSelect={() => { setAppearance("light"); setOpen(false); }} />
          </Command.Group>
          <Command.Group heading="文件" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
            {Object.keys(files).map((path) => (
              <Item
                key={path}
                icon={FileCode2}
                label={path}
                onSelect={() => {
                  setOpenFile(path);
                  setOpen(false);
                }}
              />
            ))}
          </Command.Group>
          <Command.Group heading="主题" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
            {allThemes().map((t) => (
              <Item
                key={t.id}
                icon={Palette}
                label={t.name}
                onSelect={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              />
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof Plus;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-element"
    >
      <Icon className="size-3.5 text-muted" />
      {label}
    </Command.Item>
  );
}
