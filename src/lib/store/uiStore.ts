"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GroupOption, SortOption, TaskViewMode } from "@/lib/types/sorting";
import { StatsPeriod } from "@/lib/types/stats";

const RETIRED_VIEW_MODES = new Set(["split", "grid"]);

export interface GoalsState {
  dailyFocusHours: number | null;
  weeklyFocusHours: number | null;
  dailyTasksCompleted: number | null;
  weeklyTasksCompleted: number | null;
}

interface UiState {
  // Sidebar State
  isProjectsOpen: boolean;
  toggleProjectsOpen: () => void;

  // Task List State
  sortBy: SortOption;
  groupBy: GroupOption;
  viewMode: TaskViewMode;
  setSortBy: (sort: SortOption) => void;
  setGroupBy: (group: GroupOption) => void;
  setViewMode: (mode: TaskViewMode) => void;
  // Set by TaskList/TaskBoard's drag handlers so the day_order-freeze effect
  // can skip drag-driven sortBy switches — the drag path bakes its own order.
  customSortEnteredViaDrag: boolean;
  setCustomSortEnteredViaDrag: (value: boolean) => void;

  // Habit List State
  habitViewMode: "grid" | "compact";
  setHabitViewMode: (mode: "grid" | "compact") => void;

  // Global Stats Page State
  statsPeriod: StatsPeriod;
  setStatsPeriod: (period: StatsPeriod) => void;
  // Global Settings
  timeFormat: "12h" | "24h" | "system";
  setTimeFormat: (format: "12h" | "24h" | "system") => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  backupReminderEnabled: boolean;
  setBackupReminderEnabled: (enabled: boolean) => void;
  backupReminderFrequencyDays: number;
  setBackupReminderFrequencyDays: (days: number) => void;
  autoLockEnabled: boolean;
  setAutoLockEnabled: (enabled: boolean) => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;

  // Global Goals (aggregate targets, not per-item — see CONTEXT.md "Goals")
  goals: GoalsState;
  setGoals: (goals: Partial<GoalsState>) => void;

  // Shortcuts Help Dialog
  isShortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  // PIP State (for cross-hook communication)
  isPipActive: boolean;
  setIsPipActive: (active: boolean) => void;

  // Fullscreen State (for cross-hook communication, D-09 mutual exclusion)
  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;

  // Sync State (for sync indicator, D-04)
  isSynced: boolean;
  setIsSynced: (synced: boolean) => void;

  // Archived Projects Dialog
  isArchivedProjectsOpen: boolean;
  setArchivedProjectsOpen: (open: boolean) => void;

  // Task Selection State (for component decoupling per PERF-02)
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;

  // Environment State (Non-persistent)
  isDesktop: boolean;
  setIsDesktop: (isDesktop: boolean) => void;
  // Changelog state
  isChangelogOpen: boolean;
  setChangelogOpen: (open: boolean) => void;
  lastSeenVersion: string;
  setLastSeenVersion: (version: string) => void;
  lastDismissedVersion: string;
  setLastDismissedVersion: (version: string) => void;
  // Ephemeral: true when server has a version newer than lastDismissedVersion
  hasChangelogUpdate: boolean;
  setHasChangelogUpdate: (has: boolean) => void;

  lastUndoAction: (() => void | Promise<void>) | null;
  setLastUndoAction: (action: (() => void | Promise<void>) | null) => void;
  triggerLastUndoAction: () => void | Promise<void>;

  // Id of the task yanked via vim `yy`, resolved against TanStack Query's
  // task cache at paste time rather than snapshotted here — the snapshot
  // would otherwise go stale if the task is edited between yank and paste.
  yankedTaskId: string | null;
  setYankedTaskId: (id: string | null) => void;

  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Sidebar defaults
      isProjectsOpen: true,
      toggleProjectsOpen: () =>
        set((state) => ({ isProjectsOpen: !state.isProjectsOpen })),

      // Task List defaults
      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
      setSortBy: (sort) => set({ sortBy: sort }),
      setGroupBy: (group) => set({ groupBy: group }),
      setViewMode: (mode) => set({ viewMode: mode }),
      customSortEnteredViaDrag: false,
      setCustomSortEnteredViaDrag: (value) =>
        set({ customSortEnteredViaDrag: value }),

      // Habit List defaults
      habitViewMode: "grid",
      setHabitViewMode: (mode) => set({ habitViewMode: mode }),

      // Global Stats Page defaults
      statsPeriod: "30d",
      setStatsPeriod: (period) => set({ statsPeriod: period }),

      // Global Settings defaults
      timeFormat: "system",
      setTimeFormat: (format) => set({ timeFormat: format }),
      hapticsEnabled: true,
      setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
      notificationsEnabled: false,
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
      backupReminderEnabled: true,
      setBackupReminderEnabled: (enabled) =>
        set({ backupReminderEnabled: enabled }),
      backupReminderFrequencyDays: 7,
      setBackupReminderFrequencyDays: (days) =>
        set({ backupReminderFrequencyDays: days }),
      autoLockEnabled: false,
      setAutoLockEnabled: (enabled) => set({ autoLockEnabled: enabled }),
      autoLockMinutes: 60,
      setAutoLockMinutes: (minutes) => set({ autoLockMinutes: minutes }),

      // Global Goals defaults
      goals: {
        dailyFocusHours: null,
        weeklyFocusHours: null,
        dailyTasksCompleted: null,
        weeklyTasksCompleted: null,
      },
      setGoals: (goals) => set((s) => ({ goals: { ...s.goals, ...goals } })),

      // Shortcuts Help defaults
      isShortcutsHelpOpen: false,
      setShortcutsHelpOpen: (open) =>
        set((state) => ({
          isShortcutsHelpOpen:
            typeof open === "function"
              ? (open as (prev: boolean) => boolean)(state.isShortcutsHelpOpen)
              : open,
        })),

      // PIP State defaults
      isPipActive: false,
      setIsPipActive: (active) => set({ isPipActive: active }),

      // Fullscreen State defaults
      isFullscreen: false,
      setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

      // Sync State defaults
      isSynced: false,
      setIsSynced: (synced) => set({ isSynced: synced }),

      // Archived Projects defaults
      isArchivedProjectsOpen: false,
      setArchivedProjectsOpen: (open) => set({ isArchivedProjectsOpen: open }),

      // Task Selection State defaults
      selectedTaskId: null,
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      editingTaskId: null,
      setEditingTaskId: (id) => set({ editingTaskId: id }),

      // Environment State defaults
      isDesktop: true, // Default to true to avoid mobile layout flash during hydration
      setIsDesktop: (isDesktop) => set({ isDesktop }),

      // Changelog defaults
      isChangelogOpen: false,
      setChangelogOpen: (open) => set({ isChangelogOpen: open }),
      lastSeenVersion: "",
      setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
      lastDismissedVersion: "",
      setLastDismissedVersion: (version) =>
        set({ lastDismissedVersion: version }),
      hasChangelogUpdate: false,
      setHasChangelogUpdate: (has) => set({ hasChangelogUpdate: has }),

      lastUndoAction: null,
      setLastUndoAction: (action) => set({ lastUndoAction: action }),
      triggerLastUndoAction: () => {
        const action = get().lastUndoAction;
        if (action) {
          set({ lastUndoAction: null });
          return action();
        }
      },

      yankedTaskId: null,
      setYankedTaskId: (id) => set({ yankedTaskId: id }),

      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "kanso-ui-state",
      // zustand only calls migrate() when this differs from the stored version.
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state?.lastSeenVersion && !state.lastDismissedVersion) {
          state.setLastDismissedVersion(state.lastSeenVersion);
        }
      },
      partialize: (state) => {
        // Exclude environment, hydration, and ephemeral runtime state from persistence
        const {
          isDesktop: _isDesktop,
          setIsDesktop: _setIsDesktop,
          _hasHydrated: _hasHydrated,
          setHasHydrated: _setHasHydrated,
          isFullscreen: _isFullscreen,
          setIsFullscreen: _setIsFullscreen,
          isSynced: _isSynced,
          setIsSynced: _setIsSynced,
          hasChangelogUpdate: _hasChangelogUpdate,
          setHasChangelogUpdate: _setHasChangelogUpdate,
          customSortEnteredViaDrag: _customSortEnteredViaDrag,
          setCustomSortEnteredViaDrag: _setCustomSortEnteredViaDrag,
          lastUndoAction: _lastUndoAction,
          setLastUndoAction: _setLastUndoAction,
          triggerLastUndoAction: _triggerLastUndoAction,
          yankedTaskId: _yankedTaskId,
          setYankedTaskId: _setYankedTaskId,
          ...rest
        } = state;
        return rest;
      },
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as Record<string, unknown> | undefined;
        // "split" and "grid" were both retired in favour of "list".
        if (RETIRED_VIEW_MODES.has(state?.viewMode as string)) {
          return { ...state, viewMode: "list" };
        }
        return state;
      },
    },
  ),
);
