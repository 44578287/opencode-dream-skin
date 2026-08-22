import { unifiedDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";
import type { VFile } from "@/lib/workspace";

export function DiffView({ file }: { file: VFile }) {
  const lines = unifiedDiff(file.original, file.content);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[11px] text-muted">
        <span className="font-mono text-foreground">{file.path}</span>
        <span className="text-success">+{added}</span>
        <span className="text-error">−{removed}</span>
      </div>
      <pre className="overflow-x-auto rounded-sm border border-border bg-background font-mono text-[12.5px] leading-6">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              line.type === "add" && "bg-diff-add-bg",
              line.type === "del" && "bg-diff-del-bg",
            )}
          >
            <span className="w-10 shrink-0 select-none pr-2 text-right tabular-nums text-muted">
              {line.left ?? ""}
            </span>
            <span className="w-10 shrink-0 select-none pr-3 text-right tabular-nums text-muted">
              {line.right ?? ""}
            </span>
            <span
              className={cn(
                "w-4 shrink-0",
                line.type === "add" && "text-diff-add",
                line.type === "del" && "text-diff-del",
                line.type === "same" && "text-muted",
              )}
            >
              {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
            </span>
            <span className="whitespace-pre text-foreground">{line.text || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
