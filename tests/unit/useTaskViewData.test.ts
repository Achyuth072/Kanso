import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTaskViewData } from "@/lib/hooks/useTaskViewData";
import type { Task } from "@/lib/types/task";
import { startOfDay } from "date-fns";

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: "1",
    content: "Task 1",
    priority: 1,
    is_completed: false,
    is_evening: false,
    do_date: "2026-04-21",
  } as Task,
  {
    id: "2",
    content: "Task 2",
    priority: 4,
    is_completed: false,
    is_evening: false,
    do_date: "2026-04-20",
  } as Task,
  {
    id: "3",
    content: "Task 3",
    priority: 2,
    is_completed: true,
    completed_at: "2026-04-21T10:00:00Z",
    is_evening: false,
    do_date: "2026-04-21",
  } as Task,
  {
    id: "4",
    content: "Evening Task",
    priority: 3,
    is_completed: false,
    is_evening: true,
    do_date: "2026-04-21",
  } as Task,
  {
    id: "5",
    content: "Tomorrow Task",
    priority: 2,
    is_completed: false,
    is_evening: false,
    do_date: "2026-04-22",
  } as Task,
];

describe("useTaskViewData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const date = new Date("2026-04-21T10:00:00Z");
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Test Perspective Table
   * | Scenario | Given | When | Then |
   * |----------|-------|------|------|
   * | Separation | Tasks with mixed status/evening | Hook called | Separates into active, completed, evening |
   * | Sorting | sortBy: "priority" | Hook called | Active tasks sorted by priority asc |
   * | Grouping | groupBy: "priority" | Hook called | Tasks grouped by priority labels |
   * | Date Grouping | groupBy: "date" | Hook called | Tasks grouped into Today, Tomorrow, etc. |
   * | Task Continuity | Task completed today vs yesterday | Hook called | Today's task stays in active, yesterday's is filtered |
   */

  it("separates tasks correctly in a single pass", () => {
    // Given: A set of mixed tasks
    // When: useTaskViewData is called with default options
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: mockTasks,
        sortBy: "custom",
        groupBy: "none",
      }),
    );

    // Then: It separates them into correct buckets
    // Note: Task 3 is completed on 2026-04-21 (Today) in mockTasks, so it should be in active too
    // But it should NOT be in completed to avoid duplication
    expect(result.current.active.length).toBe(4); // 1, 2, 3, 5
    expect(result.current.completed.length).toBe(0); // 3 is today, so excluded
    expect(result.current.evening.length).toBe(1); // 4
    expect(result.current.active.map((t) => t.id)).toContain("3");
  });

  it("implements task continuity: retains tasks completed today in active lists", () => {
    // Given: Tasks completed today and tasks completed yesterday
    const now = new Date("2026-04-21T10:00:00Z");
    const yesterday = new Date("2026-04-20T10:00:00Z");

    const continuityTasks: Task[] = [
      {
        id: "c1",
        content: "Completed Today",
        is_completed: true,
        completed_at: now.toISOString(),
        is_evening: false,
      } as Task,
      {
        id: "c2",
        content: "Completed Yesterday",
        is_completed: true,
        completed_at: yesterday.toISOString(),
        is_evening: false,
      } as Task,
      {
        id: "c3",
        content: "Completed Today Evening",
        is_completed: true,
        completed_at: now.toISOString(),
        is_evening: true,
      } as Task,
    ];

    // When: useTaskViewData is called
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: continuityTasks,
        sortBy: "custom",
        groupBy: "none",
      }),
    );

    // Then:
    // - Today's completed tasks are in active/evening
    // - Yesterday's completed tasks are ONLY in completed
    // - Today's completed tasks are NOT in completed (avoid duplication)
    expect(result.current.active.map((t) => t.id)).toContain("c1");
    expect(result.current.active.map((t) => t.id)).not.toContain("c2");
    expect(result.current.evening.map((t) => t.id)).toContain("c3");
    expect(result.current.completed.map((t) => t.id)).toEqual(["c2"]);
  });

  it("sorts active tasks by priority", () => {
    // Given: Tasks with different priorities
    // When: sortBy is "priority"
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: mockTasks,
        sortBy: "priority",
        groupBy: "none",
      }),
    );

    // Then: Active tasks are sorted 1 -> 2 -> 2 -> 4 (Task 1, 3, 5, 2)
    // Note: Task 3 is included because it was completed today
    const activeIds = result.current.active.map((t) => t.id);
    expect(activeIds).toEqual(["1", "3", "5", "2"]);
  });

  it("groups tasks by priority", () => {
    // Given: Tasks with different priorities
    // When: groupBy is "priority"
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: mockTasks,
        sortBy: "custom",
        groupBy: "priority",
      }),
    );

    // Then: It returns groups matching the priority labels
    expect(result.current.groups).not.toBeNull();
    const groups = result.current.groups!;
    expect(
      groups.find((g) => g.title === "Critical")?.tasks.map((t) => t.id),
    ).toEqual(["1"]);
    expect(
      groups.find((g) => g.title === "High")?.tasks.map((t) => t.id),
    ).toEqual(["3", "5"]);
    expect(
      groups.find((g) => g.title === "Medium")?.tasks.map((t) => t.id),
    ).toEqual(["4"]);
    expect(
      groups.find((g) => g.title === "Low")?.tasks.map((t) => t.id),
    ).toEqual(["2"]);
  });

  it("groups tasks by date", () => {
    // Given: Tasks with different dates (Today: 2026-04-21)
    // When: groupBy is "date"
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: mockTasks,
        sortBy: "custom",
        groupBy: "date",
      }),
    );

    // Then: It groups into Today and Tomorrow
    expect(result.current.groups).not.toBeNull();
    const groups = result.current.groups!;

    const todayGroup = groups.find((g) => g.title === "Today");
    const tomorrowGroup = groups.find((g) => g.title === "Tomorrow");
    const overdueGroup = groups.find((g) => g.title === "Overdue");

    expect(todayGroup?.tasks.map((t) => t.id)).toContain("1");
    expect(todayGroup?.tasks.map((t) => t.id)).toContain("4");
    expect(tomorrowGroup?.tasks.map((t) => t.id)).toEqual(["5"]);
    expect(overdueGroup?.tasks.map((t) => t.id)).toEqual(["2"]); // 2026-04-20 is before 2026-04-21
  });

  it("returns empty structure when tasks are undefined", () => {
    // Given: Undefined tasks
    // When: Hook called
    const { result } = renderHook(() =>
      useTaskViewData({
        tasks: undefined,
        sortBy: "custom",
        groupBy: "none",
      }),
    );

    // Then: Returns empty buckets
    expect(result.current).toEqual({
      active: [],
      completed: [],
      evening: [],
      groups: null,
    });
  });
});
