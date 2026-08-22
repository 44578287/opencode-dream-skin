import { tokenize } from "@/lib/highlight";
import { languageOf } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const kindClass: Record<string, string> = {
  comment: "text-syn-comment italic",
  keyword: "text-syn-keyword",
  string: "text-syn-string",
  number: "text-syn-number",
  func: "text-syn-func",
  type: "text-syn-type",
  punct: "text-syn-punct/80",
  plain: "text-foreground",
};

export function CodeView({ path, content, className }: { path: string; content: string; className?: string }) {
  const lang = languageOf(path);
  const lines = tokenize(content, lang);
  return (
    <pre className={cn("min-w-max font-mono text-[12.5px] leading-6", className)}>
      {lines.map((tokens, i) => (
        <div key={i} className="flex">
          <span className="w-10 shrink-0 select-none pr-3 text-right tabular-nums text-muted">
            {i + 1}
          </span>
          <span className="whitespace-pre">
            {tokens.map((t, j) => (
              <span key={j} className={kindClass[t.kind] ?? kindClass.plain}>
                {t.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </pre>
  );
}
