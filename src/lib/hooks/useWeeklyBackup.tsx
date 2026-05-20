"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { createBackupZip, downloadBackup } from "@/lib/backup/export-import";
import { mockStore } from "@/lib/mock/mock-store";
import type { BackupData } from "@/lib/backup/types";

const STORAGE_KEY = "kanso_last_backup_date";
const SESSION_KEY = "kanso_backup_prompted";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hook that prompts guest users to back up their data weekly.
 * Per RESEARCH.md: Use subtle, dismissible toast (not modal) to avoid "Kanso" violation.
 */
export function useWeeklyBackup() {
  const { isGuestMode } = useAuth();
  const hasPrompted = useRef(false);

  // Memoize lastBackupDate to prevent creating new Date object on every render
  const lastBackupDate = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Date(stored) : null;
  }, []); // Empty deps - only compute once on mount

  const updateLastBackupDate = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  }, []);

  const triggerBackup = useCallback(async () => {
    try {
      // Gather all guest data from mockStore
      const backupData: BackupData = {
        metadata: {
          version: 1,
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.14.3",
          exportedAt: new Date().toISOString(),
        },
        tasks: mockStore.getTasks(),
        projects: mockStore.getProjects(),
        habits: mockStore.getHabits(),
        habit_entries: mockStore.getHabitEntries(),
        focus_logs: mockStore.getFocusLogs(),
        events: mockStore.getEvents(),
      };

      const blob = await createBackupZip(backupData);
      downloadBackup(blob);

      // Update last backup date
      updateLastBackupDate();

      toast.success("Backup downloaded successfully");
    } catch (error) {
      console.error("Backup failed:", error);
      toast.error("Failed to create backup");
    }
  }, [updateLastBackupDate]);

  useEffect(() => {
    // Only for guest mode
    if (!isGuestMode) return;

    // Only run once per session
    if (hasPrompted.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY))
      return;

    // Check if backup is stale
    const isStale =
      !lastBackupDate || Date.now() - lastBackupDate.getTime() > SEVEN_DAYS_MS;

    if (isStale) {
      // Delay slightly to not interrupt initial page load
      const timeoutId = setTimeout(() => {
        // Only set flags AFTER we actually show the toast
        // This prevents React Strict Mode from skipping the toast
        hasPrompted.current = true;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_KEY, "true");
        }

        toast("Backup due", {
          duration: 10000,
          action: {
            label: "Backup",
            onClick: () => {
              triggerBackup();
            },
          },
        });
      }, 3000);

      return () => clearTimeout(timeoutId);
    }
  }, [isGuestMode, lastBackupDate, triggerBackup]);

  return {
    lastBackupDate,
    triggerBackup,
    updateLastBackupDate,
  };
}
