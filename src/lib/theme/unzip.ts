/** Minimal ZIP reader for Dream Skin packs (store + deflate, ≤32 files). */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_UNCOMPRESSED = 64 * 1024 * 1024;
const MAX_FILES = 32;

export type ZipEntry = { name: string; bytes: Uint8Array };

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEocd(view: DataView) {
  const min = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (u32(view, i) !== EOCD) continue;
    const comment = u16(view, i + 20);
    if (i + 22 + comment === view.byteLength) return i;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "function") {
    throw new Error("这个环境不能解压 ZIP");
  }
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function decodeName(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes).replace(/\\/g, "/");
}

function stripWrap(entries: ZipEntry[]): ZipEntry[] {
  const files = entries.filter((e) => e.name && !e.name.endsWith("/") && !e.name.split("/").some((p) => p === ".." || p === "."));
  if (!files.length) return files;
  const first = files[0]!.name.split("/")[0];
  const wrapped = files.every((e) => {
    const parts = e.name.split("/");
    return parts.length >= 2 && parts[0] === first;
  });
  if (!wrapped) return files.map((e) => ({ ...e, name: e.name.replace(/^\/+/, "") }));
  return files.map((e) => ({ ...e, name: e.name.slice(first!.length + 1) }));
}

export async function unzipBytes(input: ArrayBuffer | Uint8Array): Promise<ZipEntry[]> {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (data.byteLength > MAX_BYTES) throw new Error("主题包超过 32 MiB 上限。");
  if (data.byteLength < 22) throw new Error("不是有效的 ZIP 主题包。");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error("不是有效的 ZIP 主题包。");
  if (u16(view, eocd + 4) !== 0 || u16(view, eocd + 6) !== 0) {
    throw new Error("不支持分卷 ZIP。");
  }
  const count = u16(view, eocd + 10);
  if (count === 0) throw new Error("主题包是空的。");
  if (count > MAX_FILES) throw new Error("主题包文件过多。");
  const cdSize = u32(view, eocd + 12);
  const cdOffset = u32(view, eocd + 16);
  if (cdOffset + cdSize > data.byteLength) throw new Error("ZIP 目录损坏。");

  const out: ZipEntry[] = [];
  let cursor = cdOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < count; i++) {
    if (u32(view, cursor) !== CENTRAL) throw new Error("ZIP 目录损坏。");
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const compSize = u32(view, cursor + 20);
    const uncompSize = u32(view, cursor + 24);
    const nameLen = u16(view, cursor + 28);
    const extraLen = u16(view, cursor + 30);
    const commentLen = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const name = decodeName(data.subarray(cursor + 46, cursor + 46 + nameLen));
    cursor += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith("/")) continue;
    if (name.includes("..") || name.startsWith("/") || flags & 0x0001) {
      throw new Error("主题包含有不安全的文件。");
    }
    if (method !== 0 && method !== 8) throw new Error(`不支持的压缩方式：${name}`);
    totalUncompressed += uncompSize;
    if (uncompSize > MAX_BYTES || totalUncompressed > MAX_UNCOMPRESSED) {
      throw new Error("主题包解压后过大。");
    }
    const nameLenLocal = u16(view, localOffset + 26);
    const extraLenLocal = u16(view, localOffset + 28);
    const dataStart = localOffset + 30 + nameLenLocal + extraLenLocal;
    const payload = data.subarray(dataStart, dataStart + compSize);
    const bytes = method === 0 ? payload.slice() : await inflateRaw(payload);
    if (uncompSize && bytes.byteLength !== uncompSize) {
      throw new Error(`${name} 解压尺寸不匹配。`);
    }
    out.push({ name, bytes });
  }
  const stripped = stripWrap(out).filter((e) => e.name);
  if (!stripped.length) throw new Error("主题包里没有可用文件。");
  return stripped;
}
