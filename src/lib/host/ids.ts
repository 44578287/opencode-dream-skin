export function hid(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}_${t}${rand}`;
}
