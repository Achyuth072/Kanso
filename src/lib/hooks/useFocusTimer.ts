"use client";

import { useEffect, useCallback, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { focusMutations } from "@/lib/mutations/focus";
import { useUiStore } from "@/lib/store/uiStore";
import { useFocusHistoryStore } from "@/lib/store/focusHistoryStore";
import { useAuth } from "@/components/AuthProvider";
import { useFocusSounds } from "@/lib/hooks/useFocusSounds";
import { usePathname } from "next/navigation";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimerStore } from "@/lib/store/timerStore";
import { useTimerSync } from "@/lib/hooks/useTimerSync";
import { getDeviceId } from "@/lib/store/deviceId";
import { TimerState } from "@/lib/types/timer";
import { trackTelemetry } from "@/lib/telemetry/client";
import {
  FOCUS_DURATION_MINUTES_MIN,
  FOCUS_DURATION_MINUTES_MAX,
} from "@/lib/schemas/telemetry";

function clampFocusDurationMinutes(minutes: number): number {
  return Math.max(
    FOCUS_DURATION_MINUTES_MIN,
    Math.min(FOCUS_DURATION_MINUTES_MAX, Math.round(minutes) || 1),
  );
}

type TimerCompleteEvent = CustomEvent<{
  prevState: TimerState;
  nextState: TimerState;
  options?: {
    skipLog?: boolean;
    skipToast?: boolean;
    skipNotification?: boolean;
  };
}>;

export function useFocusTimer() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { showNotification } = usePushNotifications();
  const { isGuestMode } = useAuth();
  const { play } = useFocusSounds();
  const { trigger } = useHaptic();

  const {
    state,
    settings,
    isLoaded,
    start: storeStart,
    pause: storePause,
    stop: storeStop,
    cancel: storeCancel,
    skip: storeSkip,
    tick,
    reconcile,
    updateSettings: storeUpdateSettings,
    setLoaded,
  } = useTimerStore();

  const { upsertTimerState, claimTimerCompletion, hydrate } = useTimerSync();

  const syncToServer = useCallback(async () => {
    await upsertTimerState();
  }, [upsertTimerState]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
      queryClient.invalidateQueries({ queryKey: ["today-focus-count"] });
    },
  });

  useEffect(() => {
    const handleComplete = async (event: Event) => {
      const customEvent = event as TimerCompleteEvent;
      const { prevState, nextState, options } = customEvent.detail;

      // Atomic claim prevents duplicate session logs across concurrent devices.
      if (prevState.endsAt != null) {
        try {
          const won = await claimTimerCompletion(prevState.endsAt);
          if (!won) return;
        } catch (err) {
          Sentry.captureException(err);
        }
      } else {
        try {
          await syncToServer();
        } catch (err) {
          Sentry.captureException(err);
        }
      }

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

      if (prevState.mode === "focus") {
        trackTelemetry("focus_session", {
          status: "completed",
          duration_minutes: clampFocusDurationMinutes(settings.focusDuration),
        });
        play("sessionComplete");
      } else {
        play("breakEnd");
      }
      trigger("thud");

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

      if (!options?.skipToast && !document.hidden) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (!isOnFocusPage && !isPipActive) {
          notify(`${title} — ${description}`, {
            duration: 4000,
            icon: null,
          });
        }
      }

      if (!options?.skipNotification) {
        const isPipActive = useUiStore.getState().isPipActive;
        const isOnFocusPage = pathname === "/focus";

        if (document.hidden || (!isOnFocusPage && !isPipActive)) {
          showNotification(
            prevState.mode === "focus" ? "Focus Complete" : "Break Complete",
            {
              body:
                prevState.mode === "focus"
                  ? "Your focus session is complete. Take a break!"
                  : "Your break is over. Time to focus!",
              // Replace existing push notifications rather than stacking.
              tag: "timer_end",
              renotify: true,
              data: { url: "/focus" },
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
    syncToServer,
    claimTimerCompletion,
  ]);

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

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        const currentSeconds = useTimerStore.getState().state.remainingSeconds;

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

  const start = useCallback(
    async (taskId?: string) => {
      play("focusStart");
      storeStart(taskId);
      syncToServer();
    },
    [play, storeStart, syncToServer],
  );

  const pause = useCallback(() => {
    storePause();
    syncToServer();
  }, [storePause, syncToServer]);

  const stop = useCallback(() => {
    storeStop();
    syncToServer();
  }, [storeStop, syncToServer]);

  const cancel = useCallback(() => {
    const currentState = useTimerStore.getState().state;
    const currentSettings = useTimerStore.getState().settings;
    if (
      currentState.mode === "focus" &&
      (currentState.isRunning ||
        currentState.remainingSeconds < currentSettings.focusDuration * 60)
    ) {
      const totalSeconds = currentSettings.focusDuration * 60;
      const elapsedSeconds = Math.max(
        0,
        totalSeconds - currentState.remainingSeconds,
      );
      const durationMinutes = clampFocusDurationMinutes(elapsedSeconds / 60);
      trackTelemetry("focus_session", {
        status: "abandoned",
        duration_minutes: durationMinutes,
      });
    }
    storeCancel();
    syncToServer();
  }, [storeCancel, syncToServer]);

  const updateSettings = useCallback(
    (newSettings: Parameters<typeof storeUpdateSettings>[0]) => {
      storeUpdateSettings(newSettings);
      syncToServer();
    },
    [storeUpdateSettings, syncToServer],
  );

  // Hydrate before syncing on mount to avoid clobbering state updated on another device (#129).
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    if (isGuestMode || !useTimerStore.getState().state.isRunning) return;

    (async () => {
      await hydrate();
      const freshState = useTimerStore.getState().state;
      if (freshState.isRunning && freshState.sourceDeviceId === getDeviceId()) {
        syncToServer();
      }
    })();
  }, [isGuestMode, hydrate, syncToServer]);

  return {
    state,
    settings,
    isLoaded,
    start,
    pause,
    stop,
    cancel,
    // Dispatches timer-complete synchronously, which handles persistence.
    skip: storeSkip,
    updateSettings,
  };
}
