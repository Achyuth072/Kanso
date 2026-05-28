"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useTimerStore } from "@/lib/store/timerStore";
import { useUiStore } from "@/lib/store/uiStore";
import { focusMutations } from "@/lib/mutations/focus";
import type { TimerMode } from "@/lib/types/timer";
import { toast } from "sonner";

const VALID_MODES: TimerMode[] = ["focus", "shortBreak", "longBreak"];

function parseMode(raw: unknown, fallback: TimerMode): TimerMode {
  if (typeof raw === "string" && VALID_MODES.includes(raw as TimerMode)) {
    return raw as TimerMode;
  }
  return fallback;
}

/**
 * useTimerSync — Real-time timer sync via Supabase postgres_changes.
 *
 * Subscribes to UPDATE events on user_timer_state and applies remote state
 * to the local Zustand timer store. Self-originating writes are skipped
 * via a lastWriteAt echo guard. Stale updates are skipped via a
 * last-write-wins updated_at comparison.
 *
 * Returns { upsertTimerState } for useFocusTimer to call after every
 * local state transition.
 */
export function useTimerSync() {
  const { user, isGuestMode } = useAuth();
  const supabase = createClient();

  // Echo guard: timestamp of the last local upsert
  const lastWriteAt = useRef<number>(0);

  // Stale guard: highest seen updated_at from remote updates
  const lastKnownUpdatedAt = useRef<string | null>(null);

  /**
   * upsertTimerState — Persists current timer state to the DB.
   * Must be called after every local state transition (start/pause/stop/cancel).
   * Sets lastWriteAt so the incoming postgres_changes echo is suppressed.
   */
  const upsertTimerState = useCallback(async () => {
    lastWriteAt.current = Date.now();

    const currentState = useTimerStore.getState().state;
    if (!user) return;

    await focusMutations.upsertTimerState({
      user_id: user.id,
      mode: currentState.mode,
      remaining_seconds: currentState.remainingSeconds,
      is_running: currentState.isRunning,
      active_task_id: currentState.activeTaskId,
      updated_at: new Date().toISOString(),
    });
  }, [user]);

  useEffect(() => {
    if (isGuestMode || !user) return;

    const channel = supabase
      .channel(`timer-sync:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_timer_state",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // D-02: Echo guard — skip self-originating updates within 500ms
          if (Date.now() - lastWriteAt.current < 500) return;

          const remote = payload.new as Record<string, unknown>;

          // D-03: Stale guard — skip if remote updated_at is older or equal
          if (
            lastKnownUpdatedAt.current &&
            typeof remote.updated_at === "string" &&
            remote.updated_at <= lastKnownUpdatedAt.current
          )
            return;

          lastKnownUpdatedAt.current =
            typeof remote.updated_at === "string"
              ? remote.updated_at
              : new Date().toISOString();

          const current = useTimerStore.getState().state;
          const wasRunning = current.isRunning;

          // Apply remote state to local timer store
          useTimerStore.setState({
            state: {
              ...current,
              mode: parseMode(remote.mode, current.mode),
              remainingSeconds:
                typeof remote.remaining_seconds === "number"
                  ? remote.remaining_seconds
                  : current.remainingSeconds,
              isRunning:
                typeof remote.is_running === "boolean"
                  ? remote.is_running
                  : current.isRunning,
              activeTaskId:
                typeof remote.active_task_id === "string"
                  ? remote.active_task_id
                  : null,
            },
          });

          // Subtle toast on remote pause / stop commands
          if (wasRunning && remote.is_running === false) {
            const message =
              (remote.remaining_seconds as number) === 0
                ? "Timer stopped from another device"
                : "Timer paused from another device";
            toast(message, { duration: 3000 });
          }

          // Reconcile timer store after applying remote state to correct drift
          useTimerStore.getState().reconcile();

          useUiStore.getState().setIsSynced(true);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          useUiStore.getState().setIsSynced(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      useUiStore.getState().setIsSynced(false);
    };
  }, [isGuestMode, user, supabase]);

  return { upsertTimerState };
}
