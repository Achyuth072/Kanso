/**
 * Pomodoro Timer Types
 */

export type TimerMode = "focus" | "shortBreak" | "longBreak";

export interface TimerSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsBeforeLongBreak: number;
  autoStartBreak: boolean; // Auto-start break after focus session
  autoStartFocus: boolean; // Auto-start focus after break
}

export interface TimerState {
  mode: TimerMode;
  isRunning: boolean;
  remainingSeconds: number;
  completedSessions: number;
  activeTaskId: string | null;
  startedAt: number | null; // Unix timestamp (ms) when timer started
}

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreak: false,
  autoStartFocus: false,
};

export const TIMER_STATE_KEY = "kanso-timer-state";
export const TIMER_SETTINGS_KEY = "kanso-timer-settings";
