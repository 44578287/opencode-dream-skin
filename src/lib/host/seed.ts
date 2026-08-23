/** Default local workspace — a real project, not scripted demo chat. */
export const SEED_FILES: Record<string, string> = {
  "README.md": `# Workspace

本机 OpenCode 引擎的工作区。连上之后可以直接对这里的文件提问、规划、改代码。

## 开始

- 用规划模式先看方案
- 用构建模式让助手改文件（写入前会问权限）
- 右侧打开文件即可编辑，Ctrl+S 保存
`,
  "package.json": `{
  "name": "workspace",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "node --test src/lib.test.ts"
  }
}
`,
  "src/lib.ts": `/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Title-case a string, keeping inner spacing. */
export function titleCase(input: string) {
  return input.replace(/\\S+/g, (word) => {
    const [head = "", ...rest] = [...word];
    return head.toUpperCase() + rest.join("").toLowerCase();
  });
}

export function bytes(label: string) {
  return new TextEncoder().encode(label).length;
}
`,
  "src/lib.test.ts": `import assert from "node:assert/strict";
import test from "node:test";
import { clamp, titleCase } from "./lib.ts";

test("clamp", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test("titleCase", () => {
  assert.equal(titleCase("hello world"), "Hello World");
});
`,
  "src/index.ts": `import { clamp, titleCase } from "./lib.ts";

export function banner(name: string, width = 24) {
  const title = titleCase(name);
  const inner = clamp(title.length, 1, width);
  return title.slice(0, inner);
}

console.log(banner("workspace ready"));
`,
};

export const PROJECT_NAME = "workspace";
