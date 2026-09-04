import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import { stripContent } from "./stripContent";
import type { DiagnosticLogEntry } from "./clientLog";

export interface DiagnosticPlatformInfo {
  userAgent: string;
  language: string;
  timeZone: string;
  standalone: boolean;
  online: boolean;
  viewport: string;
}

export interface DiagnosticSettingsSnapshot {
  theme: string | undefined;
  timeFormat: string;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  backupReminderEnabled: boolean;
  backupReminderFrequencyDays: number;
  autoLockEnabled: boolean;
  autoLockMinutes: number;
  sortBy: string;
  groupBy: string;
  viewMode: string;
  habitViewMode: string;
  telemetryConsent: string;
}

export interface DiagnosticBundleInput {
  tier: "guest" | "registered";
  appVersion: string;
  releaseChannel: string;
  platform: DiagnosticPlatformInfo;
  settings: DiagnosticSettingsSnapshot;
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  events: CalendarEvent[];
  logs: DiagnosticLogEntry[];
}

export interface DiagnosticBundle {
  generatedAt: string;
  app: { version: string; releaseChannel: string };
  platform: DiagnosticPlatformInfo;
  account: { tier: "guest" | "registered" };
  settings: DiagnosticSettingsSnapshot;
  data: {
    counts: {
      tasks: number;
      projects: number;
      habits: number;
      habitEntries: number;
      events: number;
    };
    tasks: Partial<Task>[];
    projects: Partial<Project>[];
    habits: Partial<Habit>[];
    events: Partial<CalendarEvent>[];
  };
  logs: DiagnosticLogEntry[];
}

export function collectDiagnosticBundle(
  input: DiagnosticBundleInput,
): DiagnosticBundle {
  return {
    generatedAt: new Date().toISOString(),
    app: { version: input.appVersion, releaseChannel: input.releaseChannel },
    platform: input.platform,
    account: { tier: input.tier },
    settings: input.settings,
    data: {
      counts: {
        tasks: input.tasks.length,
        projects: input.projects.length,
        habits: input.habits.length,
        habitEntries: input.habitEntries.length,
        events: input.events.length,
      },
      tasks: input.tasks.map((t) => stripContent("tasks", t)),
      projects: input.projects.map((p) => stripContent("projects", p)),
      habits: input.habits.map((h) => stripContent("habits", h)),
      events: input.events.map((e) => stripContent("calendar_events", e)),
    },
    logs: input.logs,
  };
}
