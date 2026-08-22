import { Code2, GitCompare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/lib/store";
import { changedFiles } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { CodeView } from "./code-view";
import { DiffView } from "./diff-view";

export function EditorPane() {
  const files = useApp((s) => s.files);
  const openFile = useApp((s) => s.openFile);
  const rightView = useApp((s) => s.rightView);
  const setRightView = useApp((s) => s.setRightView);
  const file = files[openFile];
  const changed = changedFiles(files);

  return (
    <div className="flex h-full min-w-0 flex-col bg-background" data-ds-part="main">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <p className="truncate font-mono text-[12px] text-muted">{openFile}</p>
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
          ) : file ? (
            <CodeView path={file.path} content={file.content} />
          ) : (
            <p className="text-sm text-muted">选择一个文件。</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
