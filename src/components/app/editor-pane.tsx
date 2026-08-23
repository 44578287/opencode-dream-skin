import { useEffect, useState } from "react";
import { Code2, GitCompare, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { changedFiles } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { CodeView } from "./code-view";
import { DiffView } from "./diff-view";
import { ensureFileLoaded } from "./remote-bridge";
import { writeRemoteFile, fileStatus } from "@/lib/remote/client";

export function EditorPane() {
  const files = useApp((s) => s.files);
  const openFile = useApp((s) => s.openFile);
  const rightView = useApp((s) => s.rightView);
  const setRightView = useApp((s) => s.setRightView);
  const setFileContent = useApp((s) => s.setFileContent);
  const connection = useApp((s) => s.connection);
  const file = openFile ? files[openFile] : undefined;
  const changed = changedFiles(files);
  const [draft, setDraft] = useState(file?.content ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = Boolean(file && draft !== file.content);

  useEffect(() => {
    if (openFile) void ensureFileLoaded(openFile);
  }, [openFile]);

  useEffect(() => {
    setDraft(file?.content ?? "");
    setEditing(false);
  }, [file?.path, file?.content]);

  async function save() {
    if (!openFile) return;
    setSaving(true);
    setFileContent(openFile, draft);
    try {
      if (connection.kind !== "offline") {
        await writeRemoteFile(connection, openFile, draft);
        const status = await fileStatus(connection).catch(() => []);
        useApp.getState().setFileStatus(status);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-background" data-ds-part="main">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <p className="truncate font-mono text-[12px] text-muted">{openFile || "未打开文件"}</p>
        <div className="flex items-center gap-1">
          {rightView === "editor" && file ? (
            <Button
              size="sm"
              variant={editing ? "default" : "ghost"}
              onClick={() => {
                if (editing) void save();
                else setEditing(true);
              }}
              disabled={saving || (editing && !dirty)}
            >
              <Save className="size-3" />
              {editing ? (saving ? "保存中" : "保存") : "编辑"}
            </Button>
          ) : null}
          <div className="flex rounded-full bg-element p-0.5">
            <button
              type="button"
              onClick={() => setRightView("editor")}
              className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px]", rightView === "editor" ? "bg-background text-foreground" : "text-muted")}
            >
              <Code2 className="size-3" />
              编辑
            </button>
            <button
              type="button"
              onClick={() => setRightView("diff")}
              className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px]", rightView === "diff" ? "bg-background text-foreground" : "text-muted")}
            >
              <GitCompare className="size-3" />
              差异 {changed.length ? `(${changed.length})` : ""}
            </button>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {rightView === "diff" ? (
            changed.length ? (
              <div className="space-y-6">
                {changed.map((f) => (
                  <DiffView key={f.path} file={f} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">没有未提交的差异。</p>
            )
          ) : !openFile ? (
            <p className="text-sm text-muted">选择一个文件。</p>
          ) : editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                  e.preventDefault();
                  void save();
                }
              }}
              className="min-h-[60vh] w-full resize-y bg-transparent font-mono text-[12.5px] leading-6 text-foreground outline-none"
              spellCheck={false}
            />
          ) : file ? (
            <button type="button" className="block w-full text-left" onDoubleClick={() => setEditing(true)}>
              <CodeView path={file.path} content={file.content || "// 空文件"} />
            </button>
          ) : (
            <p className="text-sm text-muted">正在读取…</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
