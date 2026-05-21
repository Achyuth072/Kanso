"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TimerMode, TimerState, TimerSettings } from "@/lib/types/timer";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

interface TimerStore {
  state: TimerState;
  settings: TimerSettings;
  isLoaded: boolean;

  // Actions
  setLoaded: (loaded: boolean) => void;
  start: (taskId?: string) => void;
  pause: () => void;
  stop: () => void;
  cancel: () => void;
  skip: () => void;
  tick: () => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
  reconcile: () => void;

  // Internal/Transition logic
  completeTimer: (options?: { skipLog?: boolean }) => void;
}

function getDurationForMode(mode: TimerMode, settings: TimerSettings): number {
  switch (mode) {
    case "focus":
      return settings.focusDuration * 60;
    case "shortBreak":
      return settings.shortBreakDuration * 60;
    case "longBreak":
      return settings.longBreakDuration * 60;
  }
}

// Helper to get initial state
const getInitialState = (settings: TimerSettings): TimerState => ({
  mode: "focus",
  isRunning: false,
  remainingSeconds: settings.focusDuration * 60,
  completedSessions: 0,
  activeTaskId: null,
  startedAt: null,
});

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      state: getInitialState(DEFAULT_TIMER_SETTINGS),
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: false,

      setLoaded: (loaded) => set({ isLoaded: loaded }),

      start: (taskId) => {
        const { state } = get();
        const targetTaskId = taskId ?? state.activeTaskId;

        set((s) => ({
          state: {
            ...s.state,
            isRunning: true,
            activeTaskId: targetTaskId,
            startedAt: Date.now(),
          },
        }));
      },

      pause: () => {
        set((s) => ({
          state: {
            ...s.state,
            isRunning: false,
            startedAt: null,
          },
        }));
      },

      stop: () => {
        const { settings } = get();
        set({
          state: getInitialState(settings),
        });
      },

      cancel: () => {
        const { settings, state } = get();
        set({
          state: {
            ...getInitialState(settings),
            completedSessions: state.completedSessions, // PRESERVE
          },
        });
      },

      skip: () => {
        get().completeTimer({ skipLog: true });
      },

      tick: () => {
        const { state } = get();
        if (!state.isRunning) return;

        if (state.remainingSeconds <= 0) {
          get().completeTimer();
          return;
        }

        set((s) => ({
          state: {
            ...s.state,
            remainingSeconds: s.state.remainingSeconds - 1,
          },
        }));
      },

      updateSettings: (newSettings) => {
        set((s) => {
          const merged = { ...s.settings, ...newSettings };
          const newState = { ...s.state };

          // If timer is idle, sync the displayed time to new duration
          if (!s.state.isRunning) {
            newState.remainingSeconds = getDurationForMode(
              s.state.mode,
              merged,
            );
          }

          return {
            settings: merged,
            state: newState,
          };
        });
      },

      reconcile: () => {
        const { state, settings } = get();
        if (!state.isRunning || !state.startedAt) return;

        const elapsedMs = Date.now() - state.startedAt;
        const totalMs = getDurationForMode(state.mode, settings) * 1000;

        if (elapsedMs >= totalMs) {
          get().completeTimer();
        } else {
          const newRemaining = Math.max(
            0,
            Math.ceil((totalMs - elapsedMs) / 1000),
          );
          set((s) => ({
            state: {
              ...s.state,
              remainingSeconds: newRemaining,
            },
          }));
        }
      },

      completeTimer: (options) => {
        const { state, settings } = get();

        // Calculate next state
        let nextMode: TimerMode = state.mode;
        let newCompletedSessions = state.completedSessions;
        let nextIsRunning = false;
        let nextStartedAt: number | null = null;

        if (state.mode === "focus") {
          newCompletedSessions = state.completedSessions + 1;
          const isLongBreakTime =
            newCompletedSessions >= settings.sessionsBeforeLongBreak;
          nextMode = isLongBreakTime ? "longBreak" : "shortBreak";
          nextIsRunning = settings.autoStartBreak;
          nextStartedAt = nextIsRunning ? Date.now() : null;
        } else {
          nextMode = "focus";
          nextIsRunning = settings.autoStartFocus;
          newCompletedSessions =
            state.mode === "longBreak" ? 0 : state.completedSessions;
          nextStartedAt = nextIsRunning ? Date.now() : null;
        }

        const nextState: TimerState = {
          ...state,
          mode: nextMode,
          isRunning: nextIsRunning,
          remainingSeconds: getDurationForMode(nextMode, settings),
          completedSessions: newCompletedSessions,
          startedAt: nextStartedAt,
        };

        set({ state: nextState });

        // Trigger side effects via event or just let the hook handle it
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("timer-complete", {
              detail: {
                prevState: state,
                nextState,
                options,
              },
            }),
          );
        }
      },
    }),
    {
      name: "kanso-timer-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        state: s.state,
        settings: s.settings,
      }),
    },
  ),
);
