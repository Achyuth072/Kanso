import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { FocusLog } from "@/lib/types/focus";
import type { CalendarEvent } from "@/lib/types/calendar-event";

/**
 * Metadata for the backup archive to handle versioning and audits.
 */
export interface BackupMetadata {
  version: number; // Backup format version (start at 1)
  appVersion: string; // From package.json
  exportedAt: string; // ISO timestamp
}

/**
 * Root data structure for Guest Mode backups.
 * Contains all essential user data for full restoration.
 */
export interface BackupData {
  metadata: BackupMetadata;
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  focus_logs: FocusLog[];
  events: CalendarEvent[];
}
