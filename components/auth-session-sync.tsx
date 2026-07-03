"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth-context";
import { persistAuthCookie, clearAuthCookie } from "@/lib/client/auth-cookie";
import { AUTH_COOKIE_REFRESH_BUFFER_MS } from "@/lib/constants/auth";

export function AuthSessionSync() {
  const { user, loading } = useAuth();
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearRefreshTimer = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const scheduleRefresh = (
      expirationTime: string,
      sync: (forceRefresh?: boolean) => void
    ) => {
      const expiresAt = new Date(expirationTime).getTime();
      const delay = Math.max(
        0,
        expiresAt - Date.now() - AUTH_COOKIE_REFRESH_BUFFER_MS
      );
      refreshTimerRef.current = window.setTimeout(() => {
        sync(true);
      }, delay);
    };

    const syncSession = async (forceRefresh = false) => {
      clearRefreshTimer();
      if (!user) {
        clearAuthCookie();
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(forceRefresh);
        persistAuthCookie(tokenResult.token, tokenResult.expirationTime);
        if (!cancelled) {
          scheduleRefresh(tokenResult.expirationTime, syncSession);
        }
      } catch (error) {
        console.error("Failed to sync auth session cookie:", error);
      }
    };

    if (!loading) {
      void syncSession();
    }

    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, [user, loading]);

  return null;
}
