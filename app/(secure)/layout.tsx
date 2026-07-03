import type React from "react";

import { ProtectedRoute } from "@/components/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { AmountVisibilityProvider } from "@/components/amount-visibility";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AmountVisibilityProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <main className="min-w-0 max-w-full flex-1 p-6 pb-24 lg:pb-6">
            <ProtectedRoute>{children}</ProtectedRoute>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <BottomNav />
    </AmountVisibilityProvider>
  );
}
