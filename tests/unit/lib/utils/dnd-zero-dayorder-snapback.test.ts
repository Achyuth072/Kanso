/**
 * TDD test: computeReorderPairs is a no-op when all tasks have day_order=0.
 *
 * Root cause: tasks are created with day_order=0 (DB default). The
 * slot-value-swap algorithm shuffles EXISTING day_order values among
 * the reordered slots. When all values are 0, swapping [0,0,0] produces
 * [0,0,0] — server re-sorts by created_at and the drop is lost.
 *
 * Fix: when slotDayOrders are not strictly monotonically increasing
 * (i.e. ties or inversions exist), fall back to using the slot indices
 * as day_order values. Slot indices are always unique and ascending.
 */

import { describe, it, expect } from "vitest";
import { computeReorderPairs } from "@/lib/utils/task-dnd";
import type { Task } from "@/lib/types/task";

const makeTask = (id: string, dayOrder: number): Task => ({
  id,
  user_id: "user1",
  project_id: null,
  parent_id: null,
  content: `Task ${id}`,
  description: null,
  priority: 4,
  due_date: null,
  do_date: null,
  is_evening: false,
  is_completed: false,
  completed_at: null,
  day_order: dayOrder,
  recurrence: null,
  google_event_id: null,
  google_etag: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe("computeReorderPairs — all-zero day_order snap-back bug", () => {
  it("BUG: with all day_order=0, swap is a no-op — server ignores the reorder", () => {
    // All tasks have default day_order=0
    const flatTasks = [makeTask("A", 0), makeTask("B", 0), makeTask("C", 0)];

    // User drags C to the top: [C, A, B]
    const orderedIds = ["C", "A", "B"];
    const pairs = computeReorderPairs(orderedIds, flatTasks);

    // The pairs should produce DISTINCT ascending day_orders matching the
    // intended order. When server sorts by day_order ASC, it should give
    // [C, A, B].
    const sorted = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(sorted[0].id).toBe("C");
    expect(sorted[1].id).toBe("A");
    expect(sorted[2].id).toBe("B");

    // Also verify values are strictly increasing (no ties)
    expect(sorted[0].day_order).toBeLessThan(sorted[1].day_order);
    expect(sorted[1].day_order).toBeLessThan(sorted[2].day_order);
  });

  it("BUG: partial duplicates also break the swap (e.g. [0, 0, 1])", () => {
    const flatTasks = [makeTask("A", 0), makeTask("B", 0), makeTask("C", 1)];

    // User reorders to [C, B, A]
    const orderedIds = ["C", "B", "A"];
    const pairs = computeReorderPairs(orderedIds, flatTasks);

    const sorted = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(sorted[0].id).toBe("C");
    expect(sorted[1].id).toBe("B");
    expect(sorted[2].id).toBe("A");

    // Strictly increasing — no ties allowed
    expect(sorted[0].day_order).toBeLessThan(sorted[1].day_order);
    expect(sorted[1].day_order).toBeLessThan(sorted[2].day_order);
  });

  it("cross-group: reordering a subset when all day_orders are 0", () => {
    // Flat tasks: groupA has A and B, groupB has C and D — all day_order=0
    const flatTasks = [
      makeTask("A", 0),
      makeTask("B", 0),
      makeTask("C", 0),
      makeTask("D", 0),
    ];

    // User reorders groupB to [D, C]
    const orderedIds = ["D", "C"];
    const pairs = computeReorderPairs(orderedIds, flatTasks);

    const sorted = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(sorted[0].id).toBe("D");
    expect(sorted[1].id).toBe("C");
    expect(sorted[0].day_order).toBeLessThan(sorted[1].day_order);
  });

  it("already-distinct day_orders still use the swap (no regression)", () => {
    // Tasks with distinct, ascending day_orders — the swap should work fine
    const flatTasks = [makeTask("A", 0), makeTask("B", 1), makeTask("C", 2)];

    // Reverse: [C, B, A]
    const orderedIds = ["C", "B", "A"];
    const pairs = computeReorderPairs(orderedIds, flatTasks);

    // Swap: C gets d=0, B gets d=1, A gets d=2
    expect(pairs.find((p) => p.id === "C")!.day_order).toBe(0);
    expect(pairs.find((p) => p.id === "B")!.day_order).toBe(1);
    expect(pairs.find((p) => p.id === "A")!.day_order).toBe(2);

    const sorted = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(sorted[0].id).toBe("C");
    expect(sorted[1].id).toBe("B");
    expect(sorted[2].id).toBe("A");
  });
});
