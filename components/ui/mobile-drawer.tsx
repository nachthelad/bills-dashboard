"use client";

import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Drawer } from "vaul";

import { cn } from "@/lib/utils";

type MobileDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  trigger?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
};

export function MobileDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  contentClassName,
  bodyClassName,
}: MobileDrawerProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      handleOnly
      repositionInputs
    >
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100vh-1rem)] flex-col rounded-t-2xl border border-border bg-card px-4 pb-8 pt-3 shadow-lg outline-none",
            contentClassName
          )}
        >
          <Drawer.Handle className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="flex shrink-0 flex-col gap-1.5 pr-8 text-left">
            <Drawer.Title className="text-xl font-semibold">
              {title}
            </Drawer.Title>
            <Drawer.Description className="text-sm text-muted-foreground">
              {description}
            </Drawer.Description>
          </div>
          <div
            className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}
          >
            {children}
          </div>
          <Drawer.Close className="ring-offset-background focus:ring-ring absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Cerrar</span>
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
