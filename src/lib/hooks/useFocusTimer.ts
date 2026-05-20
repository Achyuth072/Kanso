"use client";

import { useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { focusMutations } from "@/lib/mutations/focus";
import { useUiStore } from "@/lib/store/uiStore";
import { useFocusHistoryStore } from "@/lib/store/focusHistoryStore";
import { useAuth } from "@/components/AuthProvider";
import { useFocusSounds } from "@/lib/hooks/useFocusSounds";
import { usePathname } from "next/navigation";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import {
  scheduleTimerNotification,
  cancelTimerNotification,
} from "@/lib/timer-api";
import { toast } from "sonner";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimerStore } from "@/lib/store/timerStore";
import { TimerState } from "@/lib/types/timer";

type TimerCompleteEvent = CustomEvent<{
  prevState: TimerState;
  nextState: TimerState;
  options?: {
    skipLog?: boolean;
    skipToast?: boolean;
    skipNotification?: boolean;
  };
}>;

/**
 * Pomodoro Focus Timer Hook - Refactored to use Zustand
 * This hook now acts as the "Engine" and "Side Effect Manager" for the timer.
 */
export function useFocusTimer() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { showNotification } = usePushNotifications();
  const { isGuestMode } = useAuth();
  const { play } = useFocusSounds();
  const { trigger } = useHaptic();

  // Get state and actions from store
  const {
    state,
    settings,
    isLoaded,
    start: storeStart,
    pause: storePause,
    stop: storeStop,
    skip: storeSkip,
    tick,
    reconcile,
    updateSettings,
    setLoaded,
  } = useTimerStore();

  const notificationIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync isLoaded
  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoaded(true);
    }
  }, [setLoaded]);

  const { mutate: logFocusSessionMutation } = useMutation({
    mutationKey: ["logFocusSession"],
    mutationFn: focusMutations.logSession,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stats-dashboard"] });
    },
  });

  const handleCancelNotification = useCallback(async () => {
    if (notificationIdRef.current) {
      try {
        await cancelTimerNotification(notificationIdRef.current);
        notificationIdRef.current = null;
      } catch (err) {
        console.warn("Failed to cancel timer notification:", err);
      }
    }
  }, []);

  // Handle timer completion side effects
  useEffect(() => {
    const handleComplete = (event: Event) => {
      const customEvent = event as TimerCompleteEvent;
      const { prevState, nextState, options } = customEvent.detail;

      // Reset notification ref
      notificationIdRef.current = null;

      // Log focus if needed
      if (!options?.skipLog && prevState.mode === "focus") {
        if (prevState.activeTaskId) {
          logFocusSessionMutation({
            task_id: prevState.activeTaskId,
            durationSeconds: settings.focusDuration * 60,
          });
        }
        useFocusHistoryStore.getState().addSession({
          taskId: prevState.activeTaskId,
          duration: settings.focusDuration * 60,
          completedAt: new Date().toISOString(),
        });
      }

      // Side feedback
      if (prevState.mode === "focus") {
        play("sessionComplete");
      } else {
        play("breakEnd");
      }
      trigger("thud");

      // Show toast / notification
      const title =
        prevState.mode === "focus"
          ? "Focus session completed"
          : "Break completed";

      const description =
        nextState.isRunning && nextState.mode !== prevState.mode
          ? `Automatically started ${
              nextState.mode === "shortBreak" ? "short break" : "focus"
            }`
          : "The timer is ready for your next session.";

      // Show toast if away from focus page or PIP
      if (!options?.skipToast && !document.hidden) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (!isOnFocusPage && !isPipActive) {
          toast(title, {
            description,
            duration: 4000,
            icon: null,
          });
        }
      }

      // Smart push notification logic
      if (!options?.skipNotification) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (document.hidden || (!isOnFocusPage && !isPipActive)) {
          showNotification(
            prevState.mode === "focus"
              ? "Focus Complete 🎯"
              : "Break Complete ☕",
            {
              body:
                prevState.mode === "focus"
                  ? "Your focus session is complete. Take a break!"
                  : "Your break is over. Time to focus!",
              tag: "timer-notification",
              renotify: true,
            } as NotificationOptions,
          );
        }
      }
    };

    window.addEventListener("timer-complete", handleComplete);
    return () => window.removeEventListener("timer-complete", handleComplete);
  }, [
    logFocusSessionMutation,
    settings.focusDuration,
    play,
    trigger,
    pathname,
    showNotification,
  ]);

  // Handle visibility change for state reconciliation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconcile();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    reconcile();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reconcile]);

  // Timer tick interval
  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        const currentSeconds = useTimerStore.getState().state.remainingSeconds;

        // Warning sounds at 1 minute remaining
        if (currentSeconds === 61) {
          const currentMode = useTimerStore.getState().state.mode;
          if (currentMode === "focus") {
            play("sessionWarning");
          } else {
            play("breakWarning");
          }
        }

        tick();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, tick, play]);

  // Server-side notification scheduling
  useEffect(() => {
    if (state.isRunning && !isGuestMode && !notificationIdRef.current) {
      const schedule = async () => {
        try {
          const { notificationId } = await scheduleTimerNotification({
            duration: state.remainingSeconds,
            taskId: state.activeTaskId,
            mode: state.mode,
          });
          notificationIdRef.current = notificationId;
        } catch (err) {
          console.warn("Failed to auto-schedule timer notification:", err);
        }
      };
      schedule();
    }
  }, [
    state.isRunning,
    state.mode,
    isGuestMode,
    state.activeTaskId,
    state.remainingSeconds,
  ]);

  // Wrapped actions to handle side effects
  const start = useCallback(
    async (taskId?: string) => {
      play("focusStart");

      const targetTaskId = taskId ?? state.activeTaskId;

      if (!isGuestMode) {
        try {
          const { notificationId } = await scheduleTimerNotification({
            duration: state.remainingSeconds,
            taskId: targetTaskId,
            mode: state.mode,
          });
          notificationIdRef.current = notificationId;
        } catch (err) {
          console.warn("Failed to schedule timer notification:", err);
        }
      }

      storeStart(taskId);
    },
    [
      play,
      isGuestMode,
      state.remainingSeconds,
      state.activeTaskId,
      state.mode,
      storeStart,
    ],
  );

  const pause = useCallback(() => {
    handleCancelNotification();
    storePause();
  }, [handleCancelNotification, storePause]);

  const stop = useCallback(() => {
    handleCancelNotification();
    storeStop();
  }, [handleCancelNotification, storeStop]);

  return {
    state,
    settings,
    isLoaded,
    start,
    pause,
    stop,
    skip: storeSkip,
    updateSettings,
  };
}
