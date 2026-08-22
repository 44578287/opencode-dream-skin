import { useState } from "react";
import { ChevronRight, FileCode2, Folder, GitBranch, Plus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { changedFiles, treeFromFiles, type VFile } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export function SidebarPane() {
  const rail = useApp((s) => s.rail);
  if (rail === "files") return <FilesRail />;
  if (rail === "search") return <SearchRail />;
  if (rail === "git") return <GitRail />;
  return <SessionsRail />;
}

function SessionsRail() {
  const sessions = useApp((s) => s.sessions);
  const active = useApp((s) => s.activeSessionId);
  const setActive = useApp((s) => s.setActiveSession);
  const create = useApp((s) => s.newSession);
  const close = useApp((s) => s.closeSession);

  return (
    <div className="flex h-full flex-col" data-ds-part="project-list">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">会话</p>
        <Button variant="ghost" size="icon-sm" onClick={create} aria-label="新会话">
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "rounded-sm px-2 py-2 text-left transition-colors duration-150",
                s.id === active ? "bg-element text-foreground" : "text-muted hover:bg-element/60 hover:text-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{s.title}</span>
                {sessions.length > 1 ? (
                  <span
                    role="button"
                    className="text-muted hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      close(s.id);
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                <span>{s.mode === "plan" ? "规划" : "构建"}</span>
                <span className="size-1 rounded-full bg-border" />
                <span>{s.messages.length} 条</span>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilesRail() {
  const files = useApp((s) => s.files);
  const openFile = useApp((s) => s.openFile);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const tree = treeFromFiles(files);
  return (
    <div className="flex h-full flex-col">
      <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">文件</p>
      <ScrollArea className="flex-1">
        <div className="px-1 pb-3">
          <Tree node={tree} depth={0} openFile={openFile} onOpen={setOpenFile} files={files} />
        </div>
      </ScrollArea>
    </div>
  );
}

function Tree({
  node,
  depth,
  openFile,
  onOpen,
  files,
}: {
  node: ReturnType<typeof treeFromFiles>;
  depth: number;
  openFile: string;
  onOpen: (p: string) => void;
  files: Record<string, VFile>;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isFile = node.kind === "file";
  const dirty = isFile && files[node.path] && files[node.path].content !== files[node.path].original;
  return (
    <div>
      <button
        type="button"
        onClick={() => (isFile ? onOpen(node.path) : setOpen((v) => !v))}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-xs px-2 py-1 text-left text-[13px]",
          isFile && openFile === node.path ? "bg-element text-foreground" : "text-muted hover:text-foreground",
        )}
        style={{ paddingLeft: 8 + depth * 10 }}
      >
        {isFile ? (
          <FileCode2 className="size-3.5 shrink-0" />
        ) : (
          <>
            <ChevronRight className={cn("size-3 shrink-0 transition-transform duration-150", open && "rotate-90")} />
            <Folder className="size-3.5 shrink-0" />
          </>
        )}
        <span className="truncate">{node.name}</span>
        {dirty ? <span className="ml-auto size-1.5 rounded-full bg-warning" /> : null}
      </button>
      {!isFile && open
        ? node.children?.map((child) => (
            <Tree key={child.path} node={child} depth={depth + 1} openFile={openFile} onOpen={onOpen} files={files} />
          ))
        : null}
    </div>
  );
}

function SearchRail() {
  const query = useApp((s) => s.searchQuery);
  const setQuery = useApp((s) => s.setSearchQuery);
  const files = useApp((s) => s.files);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const hits = query.trim()
    ? Object.values(files).flatMap((f) => {
        const lines = f.content.split("\n");
        return lines
          .map((line, i) => ({ path: f.path, line: i + 1, text: line }))
          .filter((row) => row.text.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 8);
      })
    : [];

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">搜索</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="在工作区里找…" className="pl-7" />
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {hits.map((h) => (
            <button
              key={`${h.path}:${h.line}`}
              type="button"
              onClick={() => setOpenFile(h.path)}
              className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-element"
            >
              <p className="truncate font-mono text-[11px] text-muted">{h.path}:{h.line}</p>
              <p className="truncate text-[12px]">{h.text.trim()}</p>
            </button>
          ))}
          {query && !hits.length ? <p className="px-2 text-xs text-muted">没有匹配</p> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function GitRail() {
  const files = useApp((s) => s.files);
  const changed = changedFiles(files);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const setRightView = useApp((s) => s.setRightView);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">
        <GitBranch className="size-3.5" />
        更改
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-3">
          {changed.length === 0 ? (
            <p className="px-2 text-xs text-muted">工作区干净</p>
          ) : (
            changed.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => {
                  setOpenFile(f.path);
                  setRightView("diff");
                }}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-element"
              >
                <span className="truncate font-mono text-[12px]">{f.path.replace("harbor/", "")}</span>
                <Badge tone="warning">M</Badge>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
