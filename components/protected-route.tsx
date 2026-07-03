"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type React from "react";

import { useProtectedRouteState } from "@/lib/hooks/use-protected-route";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isChecking, isAuthenticated } = useProtectedRouteState();

  useEffect(() => {
    if (!isChecking && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isChecking, router]);

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
    return null;
  }

  return <>{children}</>;
}
