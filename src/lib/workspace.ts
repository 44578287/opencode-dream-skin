export type VFile = {
  path: string;
  content: string;
  original: string;
};

export const PROJECT_ROOT = "workspace";

export function languageOf(path: string) {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "ts";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "md";
  if (path.endsWith(".css")) return "css";
  return "text";
}

export function treeFromFiles(files: Record<string, VFile>) {
  type Node = { name: string; path: string; kind: "file" | "dir"; children?: Node[] };
  const root: Node = { name: PROJECT_ROOT, path: "", kind: "dir", children: [] };

  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split("/").filter(Boolean);
    let node = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      node.children ??= [];
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: acc,
          kind: isFile ? "file" : "dir",
          children: isFile ? undefined : [],
        };
        node.children.push(child);
      }
      node = child;
    }
  }
  return root;
}

export function changedFiles(files: Record<string, VFile>) {
  return Object.values(files).filter((f) => f.content !== f.original);
}
