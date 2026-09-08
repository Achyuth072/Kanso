import { describe, expect, it } from "vitest";
import { collectDiagnosticBundle } from "@/lib/diagnostics/collectDiagnosticBundle";
import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { CalendarEvent } from "@/lib/types/calendar-event";

const TASK_CONTENT = "Buy milk for Nana";
const TASK_DESCRIPTION = "Nana's usual brand, the blue carton";
const PROJECT_NAME = "Nana's Care Plan";
const HABIT_NAME = "Call Nana";
const HABIT_DESCRIPTION = "Check in every evening";
const EVENT_TITLE = "Nana's dentist appointment";
const EVENT_LOCATION = "123 Maple Street";

function fixtureInput() {
  const task: Task = {
    id: "task-1",
    user_id: "user-1",
    project_id: "project-1",
    parent_id: null,
    content: TASK_CONTENT,
    description: TASK_DESCRIPTION,
    priority: 2,
    due_date: "2026-09-10",
    do_date: null,
    is_evening: false,
    is_completed: false,
    completed_at: null,
    day_order: 3,
    recurrence: { freq: "WEEKLY", interval: 1 },
    recurring_series_id: "series-1",
    google_event_id: null,
    google_etag: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };

  const project: Project = {
    id: "project-1",
    user_id: "user-1",
    name: PROJECT_NAME,
    color: "#FF0000",
    view_style: "list",
    is_inbox: false,
    is_archived: false,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };

  const habit: Habit = {
    id: "habit-1",
    user_id: "user-1",
    name: HABIT_NAME,
    description: HABIT_DESCRIPTION,
    color: "#00FF00",
    icon: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    archived_at: null,
    start_date: "2026-01-01",
    sort_order: 0,
    habit_type: "boolean",
  };

  const habitEntry: HabitEntry = {
    id: "entry-1",
    habit_id: "habit-1",
    date: "2026-09-01",
    value: 1,
    created_at: "2026-09-01T00:00:00.000Z",
  };

  const event: CalendarEvent = {
    id: "event-1",
    user_id: "user-1",
    title: EVENT_TITLE,
    description: null,
    location: EVENT_LOCATION,
    start_time: "2026-09-05T10:00:00.000Z",
    end_time: "2026-09-05T11:00:00.000Z",
    all_day: false,
    color: "#0000FF",
    category: "medical",
    recurrence_rule: "FREQ=WEEKLY",
    remote_id: null,
    remote_calendar_id: null,
    etag: null,
    ics_uid: "uid-1",
    sync_state: null,
    is_archived: false,
    metadata: {},
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };

  return {
    tier: "registered" as const,
    appVersion: "1.42.0",
    releaseChannel: "preview",
    platform: {
      userAgent: "vitest",
      language: "en-US",
      timeZone: "UTC",
      standalone: false,
      online: true,
      viewport: "1024x768",
    },
    settings: {
      theme: "dark",
      timeFormat: "24h",
      hapticsEnabled: true,
      notificationsEnabled: true,
      backupReminderEnabled: false,
      backupReminderFrequencyDays: 7,
      autoLockEnabled: false,
      autoLockMinutes: 5,
      sortBy: "date",
      groupBy: "none",
      viewMode: "list",
      habitViewMode: "grid",
      telemetryConsent: "unprompted",
    },
    tasks: [task],
    projects: [project],
    habits: [habit],
    habitEntries: [habitEntry],
    events: [event],
    logs: [
      {
        timestamp: "2026-09-01T00:00:00.000Z",
        category: "navigation",
        level: "info",
      },
    ],
  };
}

describe("collectDiagnosticBundle", () => {
  it("never carries task, habit, event or project content", () => {
    const bundle = collectDiagnosticBundle(fixtureInput());
    const json = JSON.stringify(bundle);

    for (const content of [
      TASK_CONTENT,
      TASK_DESCRIPTION,
      PROJECT_NAME,
      HABIT_NAME,
      HABIT_DESCRIPTION,
      EVENT_TITLE,
      EVENT_LOCATION,
    ]) {
      expect(json).not.toContain(content);
    }
  });

  it("keeps structure: item counts, recurrence rules, identifiers and timestamps", () => {
    const bundle = collectDiagnosticBundle(fixtureInput());

    expect(bundle.data.counts).toEqual({
      tasks: 1,
      projects: 1,
      habits: 1,
      habitEntries: 1,
      events: 1,
    });

    expect(bundle.data.tasks[0]).toMatchObject({
      id: "task-1",
      recurring_series_id: "series-1",
      recurrence: { freq: "WEEKLY", interval: 1 },
      created_at: "2026-09-01T00:00:00.000Z",
    });
    expect(bundle.data.events[0]).toMatchObject({
      id: "event-1",
      recurrence_rule: "FREQ=WEEKLY",
    });
    expect(bundle.data.events[0]).not.toHaveProperty("category");
    expect(bundle.data.events[0]).not.toHaveProperty("metadata");
  });
});
