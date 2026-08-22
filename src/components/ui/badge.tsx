import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "primary" | "success" | "error" | "warning";
  children: ReactNode;
}) {
  const tones = {
    muted: "text-muted bg-element",
    primary: "text-primary bg-primary/15",
    success: "text-success bg-success/15",
    error: "text-error bg-error/15",
    warning: "text-warning bg-warning/15",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
