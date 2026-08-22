import { createFileRoute } from "@tanstack/react-router";
import { DesktopShell } from "@/components/app/shell";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DesktopShell />;
}
