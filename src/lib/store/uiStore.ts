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
  isProjectsOpen: boolean;
  toggleProjectsOpen: () => void;

  sortBy: SortOption;
  groupBy: GroupOption;
  viewMode: TaskViewMode;
  setSortBy: (sort: SortOption) => void;
  setGroupBy: (group: GroupOption) => void;
  setViewMode: (mode: TaskViewMode) => void;
  // Set by drag handlers so the day_order-freeze effect skips drag-driven sortBy switches.
  customSortEnteredViaDrag: boolean;
  setCustomSortEnteredViaDrag: (value: boolean) => void;

  habitViewMode: "grid" | "compact";
  setHabitViewMode: (mode: "grid" | "compact") => void;

  statsPeriod: StatsPeriod;
  setStatsPeriod: (period: StatsPeriod) => void;
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

  // Aggregate targets, not per-item (see CONTEXT.md "Goals").
  goals: GoalsState;
  setGoals: (goals: Partial<GoalsState>) => void;

  isShortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  isPipActive: boolean;
  setIsPipActive: (active: boolean) => void;

  isFullscreen: boolean;
  setIsFullscreen: (fullscreen: boolean) => void;

  isSynced: boolean;
  setIsSynced: (synced: boolean) => void;

  isArchivedProjectsOpen: boolean;
  setArchivedProjectsOpen: (open: boolean) => void;

  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;

  isDesktop: boolean;
  setIsDesktop: (isDesktop: boolean) => void;
  isChangelogOpen: boolean;
  setChangelogOpen: (open: boolean) => void;
  lastSeenVersion: string;
  setLastSeenVersion: (version: string) => void;
  lastDismissedVersion: string;
  setLastDismissedVersion: (version: string) => void;
  // True when server has a version newer than lastDismissedVersion.
  hasChangelogUpdate: boolean;
  setHasChangelogUpdate: (has: boolean) => void;

  lastUndoAction: (() => void | Promise<void>) | null;
  setLastUndoAction: (action: (() => void | Promise<void>) | null) => void;
  triggerLastUndoAction: () => void | Promise<void>;

  // Yanked task ID resolved against cache at paste time to avoid stale data.
  yankedTaskId: string | null;
  setYankedTaskId: (id: string | null) => void;

  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      isProjectsOpen: true,
      toggleProjectsOpen: () =>
        set((state) => ({ isProjectsOpen: !state.isProjectsOpen })),

      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
      setSortBy: (sort) => set({ sortBy: sort }),
      setGroupBy: (group) => set({ groupBy: group }),
      setViewMode: (mode) => set({ viewMode: mode }),
      customSortEnteredViaDrag: false,
      setCustomSortEnteredViaDrag: (value) =>
        set({ customSortEnteredViaDrag: value }),

      habitViewMode: "grid",
      setHabitViewMode: (mode) => set({ habitViewMode: mode }),

      statsPeriod: "30d",
      setStatsPeriod: (period) => set({ statsPeriod: period }),

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
      // Clamp to prevent corrupted/stale values (<= 0) from continuously auto-locking.
      setAutoLockMinutes: (minutes) =>
        set({ autoLockMinutes: Math.max(1, minutes) }),

      goals: {
        dailyFocusHours: null,
        weeklyFocusHours: null,
        dailyTasksCompleted: null,
        weeklyTasksCompleted: null,
      },
      setGoals: (goals) => set((s) => ({ goals: { ...s.goals, ...goals } })),

      isShortcutsHelpOpen: false,
      setShortcutsHelpOpen: (open) =>
        set((state) => ({
          isShortcutsHelpOpen:
            typeof open === "function"
              ? (open as (prev: boolean) => boolean)(state.isShortcutsHelpOpen)
              : open,
        })),

      isPipActive: false,
      setIsPipActive: (active) => set({ isPipActive: active }),

      isFullscreen: false,
      setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

      isSynced: false,
      setIsSynced: (synced) => set({ isSynced: synced }),

      isArchivedProjectsOpen: false,
      setArchivedProjectsOpen: (open) => set({ isArchivedProjectsOpen: open }),

      selectedTaskId: null,
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      editingTaskId: null,
      setEditingTaskId: (id) => set({ editingTaskId: id }),

      isDesktop: true, // Avoids mobile layout flash during hydration
      setIsDesktop: (isDesktop) => set({ isDesktop }),

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

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "kanso-ui-state",
      // Zustand only calls migrate() when this differs from the stored version.
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state?.lastSeenVersion && !state.lastDismissedVersion) {
          state.setLastDismissedVersion(state.lastSeenVersion);
        }
      },
      partialize: (state) => {
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
        // "split" and "grid" were retired in favor of "list".
        if (RETIRED_VIEW_MODES.has(state?.viewMode as string)) {
          return { ...state, viewMode: "list" };
        }
        return state;
      },
    },
  ),
);
