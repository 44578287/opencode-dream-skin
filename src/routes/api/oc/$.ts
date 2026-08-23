import { createFileRoute } from "@tanstack/react-router";
import { proxyOpencode } from "@/lib/host/proxy.ts";

export const Route = createFileRoute("/api/oc/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyOpencode(request),
      POST: ({ request }) => proxyOpencode(request),
      PUT: ({ request }) => proxyOpencode(request),
      PATCH: ({ request }) => proxyOpencode(request),
      DELETE: ({ request }) => proxyOpencode(request),
      OPTIONS: ({ request }) => proxyOpencode(request),
    },
  },
});
