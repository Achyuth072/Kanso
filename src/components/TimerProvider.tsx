"use client";

import React, { createContext, useContext, ReactNode, useMemo } from "react";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import type { TimerState, TimerSettings } from "@/lib/types/timer";

interface TimerContextValue {
  // We keep the state here for legacy support, but it should be used sparingly
  // for high-frequency updates (use useTimerStore instead)
  state: TimerState;
  settings: TimerSettings;
  isLoaded: boolean;
  start: (taskId?: string) => void;
  pause: () => void;
  stop: () => void;
  skip: () => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

/**
 * TimerProvider now acts as the side-effect manager and provides stable actions.
 * Components that need the 'remainingSeconds' should use useTimerStore(s => s.state.remainingSeconds)
 * to avoid re-rendering the whole tree.
 */
export function TimerProvider({ children }: { children: ReactNode }) {
  // This hook handles intervals and side-effects centrally
  const timer = useFocusTimer();

  // We memoize the context value, but 'timer.state' still changes every second.
  // To truly prevent broadcast re-renders, we would need to remove 'state' from context
  // or use a more advanced pattern. For now, we provide it but move high-frequency
  // components to use the store directly (Task 2).
  const value = useMemo(
    () => ({
      state: timer.state,
      settings: timer.settings,
      isLoaded: timer.isLoaded,
      start: timer.start,
      pause: timer.pause,
      stop: timer.stop,
      skip: timer.skip,
      updateSettings: timer.updateSettings,
    }),
    [
      timer.state,
      timer.settings,
      timer.isLoaded,
      timer.start,
      timer.pause,
      timer.stop,
      timer.skip,
      timer.updateSettings,
    ],
  );

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
