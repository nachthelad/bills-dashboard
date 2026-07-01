"use client";

import Link from "next/link";
import type React from "react";

import { useProtectedRouteState } from "@/lib/hooks/use-protected-route";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isChecking, isAuthenticated, errorMessage } =
    useProtectedRouteState();

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    // We use window.location.href to ensure a full reload and clear any stale state
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    return null;
  }

  return <>{children}</>;
}
