export type DiffLine = {
  type: "same" | "add" | "del";
  text: string;
  left?: number;
  right?: number;
};

export function unifiedDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let lnL = 1;
  let lnR = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i], left: lnL++, right: lnR++ });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i], left: lnL++ });
      i++;
    } else {
      out.push({ type: "add", text: b[j], right: lnR++ });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++], left: lnL++ });
  while (j < m) out.push({ type: "add", text: b[j++], right: lnR++ });
  return out;
}
