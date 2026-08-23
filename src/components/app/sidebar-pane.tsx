import { useEffect, useState } from "react";
import { ChevronRight, FileCode2, Folder, GitBranch, Plus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { changedFiles, treeFromFiles, type VFile } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { createRemoteSession, deleteRemoteSession, searchRemote, writeRemoteFile } from "@/lib/remote/client";
import { ensureFileLoaded } from "./remote-bridge";

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
  const close = useApp((s) => s.closeSession);
  const connection = useApp((s) => s.connection);

  async function create() {
    if (connection.kind === "offline") {
      useApp.getState().setSettingsOpen(true);
      useApp.getState().setMobileTab("link");
      return;
    }
    const created = await createRemoteSession(connection);
    useApp.getState().hydrateSession(created);
    useApp.getState().setActiveSession(created.id);
  }

  async function remove(id: string) {
    if (connection.kind !== "offline") {
      await deleteRemoteSession(connection, id).catch(() => undefined);
    }
    close(id);
  }

  return (
    <div className="flex h-full flex-col" data-ds-part="project-list">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">会话</p>
        <Button variant="ghost" size="icon-sm" onClick={() => void create()} aria-label="新会话">
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-3">
          {sessions.length === 0 ? (
            <p className="px-2 py-6 text-xs text-muted">连接主机后会列出会话。</p>
          ) : (
            sessions.map((s) => (
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
                        void remove(s.id);
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
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FilesRail() {
  const files = useApp((s) => s.files);
  const openFile = useApp((s) => s.openFile);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const connection = useApp((s) => s.connection);
  const tree = Object.keys(files).length ? treeFromFiles(files) : null;
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("");

  function open(path: string) {
    setOpenFile(path);
    void ensureFileLoaded(path);
  }

  async function createFile() {
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path || connection.kind === "offline") return;
    await writeRemoteFile(connection, path, "");
    useApp.getState().upsertFile({ path, content: "", original: "" });
    setOpenFile(path);
    setCreating(false);
    setNewPath("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">文件</p>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCreating((v) => !v)}
          aria-label="新建文件"
          disabled={connection.kind === "offline"}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      {creating ? (
        <form
          className="flex gap-1 px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createFile();
          }}
        >
          <Input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="src/new.ts"
            autoFocus
            className="h-8 text-[12px]"
          />
          <Button size="sm" type="submit" disabled={!newPath.trim()}>
            建
          </Button>
        </form>
      ) : null}
      <ScrollArea className="flex-1">
        <div className="px-1 pb-3">
          {tree ? (
            <Tree node={tree} depth={0} openFile={openFile} onOpen={open} files={files} />
          ) : (
            <p className="px-2 py-6 text-xs text-muted">连接后加载工作区。</p>
          )}
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
  const hits = useApp((s) => s.searchHits);
  const setHits = useApp((s) => s.setSearchHits);
  const setOpenFile = useApp((s) => s.setOpenFile);
  const connection = useApp((s) => s.connection);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q || connection.kind === "offline") {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setBusy(true);
      void searchRemote(connection, q)
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, connection, setHits]);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">搜索</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="在工作区里找…" className="pl-7" />
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {hits.map((h, i) => (
            <button
              key={`${h.path}:${h.line}:${i}`}
              type="button"
              onClick={() => {
                setOpenFile(h.path);
                void ensureFileLoaded(h.path);
              }}
              className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-element"
            >
              <p className="truncate font-mono text-[11px] text-muted">
                {h.path}:{h.line}
              </p>
              <p className="truncate text-[12px]">{h.text.trim()}</p>
            </button>
          ))}
          {query && !hits.length && !busy ? <p className="px-2 text-xs text-muted">没有匹配</p> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function GitRail() {
  const files = useApp((s) => s.files);
  const remoteStatus = useApp((s) => s.fileStatus);
  const changed = remoteStatus.length
    ? remoteStatus.map((r) => ({ path: r.path, status: r.status, content: files[r.path]?.content ?? "", original: files[r.path]?.original ?? "" }))
    : changedFiles(files);
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
                  void ensureFileLoaded(f.path);
                }}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-element"
              >
                <span className="truncate font-mono text-[12px]">{f.path}</span>
                <Badge tone="warning">{"status" in f ? String((f as { status?: string }).status || "M")[0]!.toUpperCase() : "M"}</Badge>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
