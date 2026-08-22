import type { HostEvent } from "./events";

const KNOWN = new Set([
  "server.connected",
  "session.updated",
  "session.deleted",
  "session.status",
  "session.idle",
  "session.error",
  "message.updated",
  "message.removed",
  "message.part.updated",
  "message.part.delta",
  "permission.asked",
  "permission.replied",
  "question.asked",
  "question.replied",
  "question.rejected",
]);

function parseBlock(block: string): HostEvent | null {
  const dataLines: string[] = [];
  for (const raw of block.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  const data = dataLines.join("\n").trim();
  if (!data || data === "[DONE]") return null;
  try {
    const parsed = JSON.parse(data) as HostEvent;
    if (parsed && typeof parsed === "object" && KNOWN.has(parsed.type)) return parsed;
  } catch {
    return null;
  }
  return null;
}

/** Parse an OpenCode `text/event-stream` body into host bus events. */
export async function* readSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<HostEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      buf = buf.replace(/\r\n/g, "\n");
      let sep = buf.indexOf("\n\n");
      while (sep >= 0) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const event = parseBlock(block);
        if (event) yield event;
        sep = buf.indexOf("\n\n");
      }
    }
    const tail = parseBlock(buf);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}
