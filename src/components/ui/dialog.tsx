import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-150" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(720px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border border-border bg-panel p-4 shadow-window",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-[opacity,transform] duration-200",
          "max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
          className,
        )}
        data-ds-part="dialog"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-4 pt-4">
          <DialogPrimitive.Title className="text-sm font-medium tracking-tight">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="关闭">
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
