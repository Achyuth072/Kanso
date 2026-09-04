"use client";

import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { useUiStore } from "@/lib/store/uiStore";
import { getTelemetryConsent } from "@/lib/telemetry/store";
import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import { collectCloudBackup } from "@/lib/backup/cloud-data";
import { getRecentClientLogs } from "@/lib/diagnostics/clientLog";
import {
  collectDiagnosticBundle,
  type DiagnosticBundle,
  type DiagnosticPlatformInfo,
} from "@/lib/diagnostics/collectDiagnosticBundle";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
const RELEASE_CHANNEL = process.env.NEXT_PUBLIC_RELEASE_CHANNEL || "preview";

function getPlatformInfo(): DiagnosticPlatformInfo {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    online: navigator.onLine,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export function useDiagnosticBundle() {
  const { isGuestMode } = useAuth();
  const { theme } = useTheme();
  const timeFormat = useUiStore((s) => s.timeFormat);
  const hapticsEnabled = useUiStore((s) => s.hapticsEnabled);
  const notificationsEnabled = useUiStore((s) => s.notificationsEnabled);
  const backupReminderEnabled = useUiStore((s) => s.backupReminderEnabled);
  const backupReminderFrequencyDays = useUiStore(
    (s) => s.backupReminderFrequencyDays,
  );
  const autoLockEnabled = useUiStore((s) => s.autoLockEnabled);
  const autoLockMinutes = useUiStore((s) => s.autoLockMinutes);
  const sortBy = useUiStore((s) => s.sortBy);
  const groupBy = useUiStore((s) => s.groupBy);
  const viewMode = useUiStore((s) => s.viewMode);
  const habitViewMode = useUiStore((s) => s.habitViewMode);

  const generateBundle = async (): Promise<DiagnosticBundle> => {
    const settings = {
      theme,
      timeFormat,
      hapticsEnabled,
      notificationsEnabled,
      backupReminderEnabled,
      backupReminderFrequencyDays,
      autoLockEnabled,
      autoLockMinutes,
      sortBy,
      groupBy,
      viewMode,
      habitViewMode,
      telemetryConsent: getTelemetryConsent(),
    };

    const { tasks, projects, habits, habit_entries, events } = isGuestMode
      ? {
          tasks: mockStore.getTasks(),
          projects: mockStore.getProjects(),
          habits: mockStore.getHabits(),
          habit_entries: mockStore.getHabitEntries(),
          events: mockStore.getEvents(),
        }
      : await collectCloudBackup(createClient());

    return collectDiagnosticBundle({
      tier: isGuestMode ? "guest" : "registered",
      appVersion: APP_VERSION,
      releaseChannel: RELEASE_CHANNEL,
      platform: getPlatformInfo(),
      settings,
      tasks,
      projects,
      habits,
      habitEntries: habit_entries,
      events,
      logs: getRecentClientLogs(),
    });
  };

  return { generateBundle };
}
