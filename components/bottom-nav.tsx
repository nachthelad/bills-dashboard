"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mobileMoreNavItems,
  mobilePrimaryNavItems,
} from "@/lib/nav-items";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreIsActive = mobileMoreNavItems.some(
    (item) => pathname === item.url || pathname.startsWith(`${item.url}/`)
  );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-16">
            {mobilePrimaryNavItems.map((item) => {
              const isActive =
                pathname === item.url || pathname.startsWith(`${item.url}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  style={{ touchAction: "manipulation" }}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0 left-1/2 h-[2px] -translate-x-1/2 rounded-b-full transition-all duration-200",
                      isActive ? "w-6 bg-primary" : "w-0"
                    )}
                  />
                  <Icon
                    className="size-[18px] shrink-0 transition-all duration-150"
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span className="text-[10px] font-medium leading-none tracking-tight">
                    {item.title}
                  </span>
                </Link>
              );
            })}
            <button
              type="button"
              style={{ touchAction: "manipulation" }}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                moreIsActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
              aria-label="Más opciones"
              onClick={() => setMoreOpen(true)}
            >
              <span
                className={cn(
                  "absolute top-0 left-1/2 h-[2px] -translate-x-1/2 rounded-b-full transition-all duration-200",
                  moreIsActive ? "w-6 bg-primary" : "w-0"
                )}
              />
              <MoreHorizontal className="size-[18px] shrink-0" />
              <span className="text-[10px] font-medium leading-none tracking-tight">
                Más
              </span>
            </button>
          </div>
        </div>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>Más opciones</SheetTitle>
            <SheetDescription>
              Accedé a configuración, ingresos y expensas.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {mobileMoreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.url || pathname.startsWith(`${item.url}/`);
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
