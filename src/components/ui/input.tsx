import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-sm border border-border bg-element px-3 text-sm text-foreground placeholder:text-muted",
        "focus-visible:border-border-active focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
