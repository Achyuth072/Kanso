"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const LINGER_MS = 150;

/**
 * Global Sync Indicator.
 *
 * Shows immediately when any TanStack Query operation starts.
 * Lingers for LINGER_MS after the last operation ends so users can perceive it.
 * Hidden during auth loading phase and in guest mode.
 */
export function SyncIndicator() {
  const { isGuestMode, loading } = useAuth();

  // Don't render while auth is still loading or guest
  if (loading || isGuestMode) return null;

  return <SyncIndicatorContent />;
}

function SyncIndicatorContent() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isSyncing = isFetching > 0 || isMutating > 0;

  const [visible, setVisible] = useState(false);
  const wasSyncingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isSyncing) {
      wasSyncingRef.current = true;
      // Defer state update to satisfy linter and avoid cascading renders
      const timer = setTimeout(() => setVisible(true), 0);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      return () => clearTimeout(timer);
    } else if (wasSyncingRef.current) {
      wasSyncingRef.current = false;
      timerRef.current = setTimeout(() => setVisible(false), LINGER_MS);
    }
  }, [isSyncing]);

  // Cleanup on unmount only
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      className="flex items-center gap-1.5 transition-opacity duration-300"
      role="status"
      aria-label="Syncing"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-xs hidden sm:inline font-medium text-muted-foreground">
        Syncing...
      </span>
    </div>
  );
}
