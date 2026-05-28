"use client";

import { memo } from "react";
import { Link2 } from "lucide-react";
import { useTimerStore } from "@/lib/store/timerStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * Focus Timer Sync Indicator
 *
 * Static icon reflecting the sync state of the timer session.
 * Per D-04: NO pulse, NO animation, NO spin — only transition-opacity.
 *
 * Per UI-SPEC SYNC-IND-01:
 * - Synced: text-brand opacity-70, icon + "Syncing" label (sm+)
 * - Offline: text-muted-foreground opacity-30, icon only
 * - Hidden: guest mode or no active session
 *
 * Wrapped in React.memo for performance (matches FloatingTimer pattern).
 */

function SyncIndicatorInner() {
  const isSynced = useUiStore((state) => state.isSynced);
  const { isGuestMode } = useAuth();
  const { isRunning, remainingSeconds } = useTimerStore((state) => state.state);
  const totalSeconds = useTimerStore((state) => {
    const settings = state.settings;
    const mode = state.state.mode;
    switch (mode) {
      case "focus":
        return settings.focusDuration * 60;
      case "shortBreak":
        return settings.shortBreakDuration * 60;
      case "longBreak":
        return settings.longBreakDuration * 60;
    }
  });

  // Hidden when guest or no active session
  if (isGuestMode) return null;
  if (!isRunning && remainingSeconds >= totalSeconds) return null;

  return (
    <div
      role="status"
      aria-label={
        isSynced
          ? "Session syncing across devices"
          : "Offline — session not syncing"
      }
      className="flex items-center gap-1.5"
    >
      <Link2
        className={cn(
          "h-4 w-4 transition-opacity duration-500",
          isSynced
            ? "text-brand opacity-70"
            : "text-muted-foreground opacity-30",
        )}
        strokeWidth={2.25}
      />
      {isSynced && (
        <span className="hidden sm:inline text-[13px] text-muted-foreground/70">
          Syncing
        </span>
      )}
    </div>
  );
}

export const FocusSyncIndicator = memo(SyncIndicatorInner);
