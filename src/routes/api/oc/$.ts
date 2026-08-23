import { createFileRoute } from "@tanstack/react-router";
import { handleOpencode } from "@/lib/host/handle.ts";

export const Route = createFileRoute("/api/oc/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleOpencode(request),
      POST: ({ request }) => handleOpencode(request),
      PUT: ({ request }) => handleOpencode(request),
      PATCH: ({ request }) => handleOpencode(request),
      DELETE: ({ request }) => handleOpencode(request),
      OPTIONS: ({ request }) => handleOpencode(request),
    },
  },
});
