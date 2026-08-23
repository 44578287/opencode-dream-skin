import type { HostEvent } from "../remote/events.ts";

type Sink = (event: HostEvent) => void;

const sinks = new Set<Sink>();

export function publish(event: HostEvent) {
  for (const sink of sinks) {
    try {
      sink(event);
    } catch {
      /* ignore a broken subscriber */
    }
  }
}

export function subscribe(sink: Sink) {
  sinks.add(sink);
  return () => {
    sinks.delete(sink);
  };
}

export function sinkCount() {
  return sinks.size;
}
