import { cn } from "@/lib/utils";

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = splitFences(text);
  return (
    <div className={cn("space-y-2 text-[13px] leading-relaxed text-pretty", className)}>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-sm bg-element px-3 py-2 font-mono text-[12px] text-syn-func"
          >
            <code>{block.body}</code>
          </pre>
        ) : (
          <p key={i} className="text-foreground">
            {inline(block.body)}
          </p>
        ),
      )}
    </div>
  );
}

function splitFences(text: string) {
  const parts = text.split(/```[\w-]*\n?/);
  const out: { type: "text" | "code"; body: string }[] = [];
  parts.forEach((part, i) => {
    const body = part.replace(/```$/, "").trim();
    if (!body) return;
    out.push({ type: i % 2 === 0 ? "text" : "code", body });
  });
  return out.length ? out : [{ type: "text" as const, body: text }];
}

function inline(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return chunks.map((chunk, i) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return (
        <strong key={i} className="font-medium">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code key={i} className="rounded-xs bg-element px-1 py-0.5 font-mono text-[12px] text-syn-string">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{chunk}</span>;
  });
}
