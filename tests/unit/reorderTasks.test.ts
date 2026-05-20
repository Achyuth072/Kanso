import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startOfDay, addDays, format, parseISO } from "date-fns";
import type { Task } from "@/lib/types/task";
import type { GroupOption } from "@/lib/types/sorting";

/**
 * Logic to be implemented in TaskList.tsx / handleDragEnd
 */
function calculateUpdatedTaskProperty(
  task: Task,
  overContainerId: string,
  groupBy: GroupOption,
  today: Date,
): Partial<Task> | null {
  if (groupBy === "none") {
    if (overContainerId === "evening-section") return { is_evening: true };
    if (overContainerId === "active-section") return { is_evening: false };
    return null;
  }

  if (groupBy === "priority") {
    const priorityMap: Record<string, number> = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4,
    };
    const newPriority = priorityMap[overContainerId] as
      | 1
      | 2
      | 3
      | 4
      | undefined;
    if (newPriority !== undefined) {
      return { priority: newPriority };
    }
  }

  if (groupBy === "date") {
    if (overContainerId === "Today") {
      return { do_date: format(today, "yyyy-MM-dd") };
    }
    if (overContainerId === "Tomorrow") {
      return { do_date: format(addDays(today, 1), "yyyy-MM-dd") };
    }
    if (overContainerId === "No Date") {
      return { do_date: null, due_date: null };
    }
    if (overContainerId === "Upcoming") {
      // For upcoming, we could set it to 2 days from now if it doesn't have a date,
      // or keep it as is if it's already upcoming.
      // Minimalist approach: if moving to upcoming and it's not already future, set to +2 days.
      const current = task.do_date || task.due_date;
      if (
        !current ||
        isToday(parseISO(current)) ||
        isBefore(parseISO(current), today)
      ) {
        return { do_date: format(addDays(today, 2), "yyyy-MM-dd") };
      }
    }
  }

  if (groupBy === "project") {
    if (overContainerId === "Inbox") {
      return { project_id: null };
    }
    // overContainerId would be the project title or ID.
    // In our implementation, we'll likely use project ID as container ID.
    return { project_id: overContainerId };
  }

  return null;
}

// Helper to match useTaskViewData logic
function isToday(date: Date) {
  const today = startOfDay(new Date());
  return startOfDay(date).getTime() === today.getTime();
}

function isBefore(date: Date, reference: Date) {
  return startOfDay(date).getTime() < startOfDay(reference).getTime();
}

describe("Task Reordering & Grouping Logic", () => {
  const today = new Date("2026-04-21T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates priority update when dragging between priority groups", () => {
    const task = { id: "1", priority: 4 } as Task;
    const updates = calculateUpdatedTaskProperty(
      task,
      "Critical",
      "priority",
      today,
    );
    expect(updates).toEqual({ priority: 1 });
  });

  it("calculates date update when dragging to 'Today'", () => {
    const task = { id: "1", do_date: "2026-04-25" } as Task;
    const updates = calculateUpdatedTaskProperty(task, "Today", "date", today);
    expect(updates).toEqual({ do_date: "2026-04-21" });
  });

  it("calculates date update when dragging to 'Tomorrow'", () => {
    const task = { id: "1", do_date: "2026-04-21" } as Task;
    const updates = calculateUpdatedTaskProperty(
      task,
      "Tomorrow",
      "date",
      today,
    );
    expect(updates).toEqual({ do_date: "2026-04-22" });
  });

  it("clears dates when dragging to 'No Date'", () => {
    const task = {
      id: "1",
      do_date: "2026-04-21",
      due_date: "2026-04-21",
    } as Task;
    const updates = calculateUpdatedTaskProperty(
      task,
      "No Date",
      "date",
      today,
    );
    expect(updates).toEqual({ do_date: null, due_date: null });
  });

  it("updates project_id when dragging to 'Inbox'", () => {
    const task = { id: "1", project_id: "p1" } as Task;
    const updates = calculateUpdatedTaskProperty(
      task,
      "Inbox",
      "project",
      today,
    );
    expect(updates).toEqual({ project_id: null });
  });

  it("updates project_id when dragging to a specific project", () => {
    const task = { id: "1", project_id: null } as Task;
    const updates = calculateUpdatedTaskProperty(
      task,
      "project-123",
      "project",
      today,
    );
    expect(updates).toEqual({ project_id: "project-123" });
  });
});
