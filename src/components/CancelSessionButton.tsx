"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useTimerStore } from "@/lib/store/timerStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

/**
 * Cancel Session Button
 *
 * Discreet text link below the main timer controls that allows users
 * to abandon a session without logging it to focus history.
 *
 * Per D-05: cancel() preserves completedSessions.
 * Per D-06: styled as muted text link, NOT a button variant.
 * Per UI-SPEC CANCEL-01: Not destructive color. Hover underline only.
 *
 * Visibility: Only shown when a session is active (running or paused mid-session).
 *
 * DESIGN TOKENS — INK & MATTE ALIGNMENT:
 * - Typography (text-[11px] font-medium uppercase tracking-widest) mirrors the
 *   MODE_LABELS badge in app/focus/page.tsx so both read as siblings in the
 *   same typographic system.
 * - Color (text-muted-foreground/70 → text-muted-foreground on hover) uses
 *   opacity to reveal the link on hover rather than jumping to text-foreground,
 *   keeping the feel ink & matte (subdued, no accent color, no destructive red).
 */

const ACTIVE_CLASSES =
  "text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground hover:underline underline-offset-4 transition-colors duration-150 cursor-pointer";

export function CancelSessionButton() {
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
  const cancel = useTimerStore((state) => state.cancel);
  const { trigger } = useHaptic();

  const handleClick = useCallback(() => {
    trigger("tick");
    cancel();
    toast("Session cancelled", {
      duration: 1500,
    });
  }, [cancel, trigger]);

  const isSessionActive = isRunning || remainingSeconds < totalSeconds;

  if (!isSessionActive) return null;

  return (
    <div className="py-4 flex justify-center">
      <button
        onClick={handleClick}
        className={cn(
          ACTIVE_CLASSES,
          "transition-opacity duration-300 cursor-pointer",
        )}
        type="button"
      >
        Cancel session
      </button>
    </div>
  );
}
