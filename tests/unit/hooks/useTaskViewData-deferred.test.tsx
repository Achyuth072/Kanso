/**
 * Regression test for DnD optimistic state flicker caused by useDeferredValue lag.
 *
 * Root Cause (line 40 of useTaskViewData.ts):
 *   const deferredTasks = useDeferredValue(tasks);
 *
 * In the browser, useDeferredValue may return the previous (stale) task array for
 * one render cycle after an optimistic cache update. When the DnD lock is released
 * (lockLocal=false / pendingMutation=false), the component switches from local
 * state to processedTasks. If processedTasks.active still has the old order due to
 * useDeferredValue lag, the UI flickers: the dropped task briefly appears at its
 * origin position before snapping to the target.
 *
 * This test mocks useDeferredValue to simulate the one-render lag that browsers
 * exhibit but jsdom does not. It verifies that useTaskViewData uses the LATEST
 * task data (not a deferred version), ensuring no flicker during DnD lock release.
 *
 * TDD Red → Green:
 *   RED:  With useDeferredValue(tasks), the mock returns stale data → stale order
 *   GREEN: After removing useDeferredValue, tasks is used directly → correct order
 */

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Task } from "@/lib/types/task";

// ---------------------------------------------------------------------------
// Mock useDeferredValue to simulate one-render lag (browser behavior)
// ---------------------------------------------------------------------------
// In the browser, useDeferredValue returns the previous value during concurrent
// renders. jsdom does not simulate this. Our mock returns the previous value when
// deferral is enabled, proving that the hook is vulnerable to stale data.

let shouldDefer = false;
let previousValue: unknown = undefined;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useDeferredValue: (value: unknown) => {
      const result =
        shouldDefer && previousValue !== undefined ? previousValue : value;
      previousValue = value;
      return result;
    },
  };
});

// Import AFTER mock setup so useTaskViewData gets the mocked useDeferredValue
import { useTaskViewData } from "@/lib/hooks/useTaskViewData";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const makeTask = (id: string, dayOrder: number): Task => ({
  id,
  user_id: "guest",
  content: `Task ${id}`,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: dayOrder,
  created_at: "2026-05-13T00:00:00.000Z",
  updated_at: "2026-05-13T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  google_event_id: null,
  google_etag: null,
});

const makeTasks = (ids: string[]): Task[] =>
  ids.map((id, i) => makeTask(id, i));

describe("useTaskViewData — deferred value flicker regression", () => {
  beforeEach(() => {
    shouldDefer = false;
    previousValue = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("immediately reflects reordered tasks when sortBy is custom, even if useDeferredValue returns stale data", () => {
    // STEP 1: Initial render with tasks in original order
    const initialTasks = makeTasks(["t1", "t2", "t3", "t4", "t5"]);

    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) =>
        useTaskViewData({ tasks, sortBy: "custom", groupBy: "none" }),
      { initialProps: { tasks: initialTasks } },
    );

    // Verify initial order
    expect(result.current.active.map((t) => t.id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
    ]);

    // STEP 2: Enable deferral to simulate browser useDeferredValue lag.
    // After enabling, the next useDeferredValue call will return the PREVIOUS
    // (stale) value instead of the current one.
    shouldDefer = true;

    // STEP 3: Rerender with reordered tasks.
    // This simulates the optimistic cache update after a drag-and-drop.
    // In the browser, useDeferredValue would return the OLD order on this
    // render, causing processedTasks.active to show stale data.
    const reorderedTasks = makeTasks(["t2", "t3", "t1", "t4", "t5"]);
    rerender({ tasks: reorderedTasks });

    // STEP 4: CRITICAL ASSERTION
    // The output MUST reflect the NEW order, not the deferred (stale) order.
    // With the bug (useDeferredValue used), the mock returns stale data
    // and processedTasks.active has the OLD order → TEST FAILS.
    // After the fix (useDeferredValue removed from useTaskViewData), tasks
    // is used directly → processedTasks.active has the NEW order → TEST PASSES.
    expect(result.current.active.map((t) => t.id)).toEqual([
      "t2",
      "t3",
      "t1",
      "t4",
      "t5",
    ]);
  });

  it("immediately reflects task reordering even with extreme deferment (stuck on initial value)", () => {
    // An even more aggressive test: useDeferredValue always returns the
    // initial value (extreme deferment). This demonstrates that the hook
    // should never be blocked by a stale deferred value.
    const initialTasks = makeTasks(["a", "b", "c"]);
    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) =>
        useTaskViewData({ tasks, sortBy: "custom", groupBy: "none" }),
      { initialProps: { tasks: initialTasks } },
    );

    expect(result.current.active.map((t) => t.id)).toEqual(["a", "b", "c"]);

    // Enable deferral — subsequent renders get stale value
    shouldDefer = true;

    // Reorder: move 'a' to the end
    const reordered = makeTasks(["b", "c", "a"]);
    rerender({ tasks: reordered });

    // Must show the re-ordered tasks, not the stale ones
    expect(result.current.active.map((t) => t.id)).toEqual(["b", "c", "a"]);

    // Reorder again: reverse
    const reversed = makeTasks(["c", "b", "a"]);
    rerender({ tasks: reversed });

    // Must still reflect the latest input
    expect(result.current.active.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("immediately reflects evening task reordering without deferred lag", () => {
    // Verify that evening tasks are also correctly ordered even with deferment
    const initialTasks = [
      makeTask("a1", 0),
      makeTask("a2", 1),
      { ...makeTask("e1", 2), is_evening: true },
      { ...makeTask("e2", 3), is_evening: true },
    ];

    const { result, rerender } = renderHook(
      ({ tasks }: { tasks: Task[] }) =>
        useTaskViewData({ tasks, sortBy: "custom", groupBy: "none" }),
      { initialProps: { tasks: initialTasks } },
    );

    expect(result.current.active.map((t) => t.id)).toEqual(["a1", "a2"]);
    expect(result.current.evening.map((t) => t.id)).toEqual(["e1", "e2"]);

    shouldDefer = true;

    // Reorder evening tasks
    const reordered = [
      makeTask("a1", 0),
      makeTask("a2", 1),
      { ...makeTask("e2", 3), is_evening: true },
      { ...makeTask("e1", 2), is_evening: true },
    ];

    rerender({ tasks: reordered });

    // Evening tasks should reflect new order immediately, not stale order
    expect(result.current.evening.map((t) => t.id)).toEqual(["e2", "e1"]);
  });
});
