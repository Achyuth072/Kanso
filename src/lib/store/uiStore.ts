"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GroupOption, SortOption } from "@/lib/types/sorting";

interface UiState {
  // Sidebar State
  isProjectsOpen: boolean;
  toggleProjectsOpen: () => void;

  // Task List State
  sortBy: SortOption;
  groupBy: GroupOption;
  viewMode: "list" | "grid" | "board";
  setSortBy: (sort: SortOption) => void;
  setGroupBy: (group: GroupOption) => void;
  setViewMode: (mode: "list" | "grid" | "board") => void;
  // Global Settings
  timeFormat: "12h" | "24h" | "system";
  setTimeFormat: (format: "12h" | "24h" | "system") => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;

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

  // Hydration state
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      // Sidebar defaults
      isProjectsOpen: true,
      toggleProjectsOpen: () =>
        set((state) => ({ isProjectsOpen: !state.isProjectsOpen })),

      // Task List defaults
      sortBy: "date",
      groupBy: "none",
      viewMode: "grid",
      setSortBy: (sort) => set({ sortBy: sort }),
      setGroupBy: (group) => set({ groupBy: group }),
      setViewMode: (mode) => set({ viewMode: mode }),

      // Global Settings defaults
      timeFormat: "system",
      setTimeFormat: (format) => set({ timeFormat: format }),
      hapticsEnabled: true,
      setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
      notificationsEnabled: false,
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),

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

      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "kanso-ui-state",
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
          ...rest
        } = state;
        return rest;
      },
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as Record<string, unknown> | undefined;
        // Migrate legacy "split" viewMode to "list"
        if (state?.viewMode === "split") {
          return { ...state, viewMode: "list" };
        }
        return state;
      },
    },
  ),
);
