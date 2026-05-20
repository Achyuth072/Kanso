/**
 * TDD tests for the alphabetic snap-back bug.
 *
 * Root cause: when sortBy !== "custom", handleDragStart captures
 * preDragFlatTasksRef in DISPLAY order (alphabetical/priority/etc.)
 * rather than day_order order. computeReorderPairs assumes flatTasks
 * is sorted by day_order so that slot positions map to ascending
 * day_order slots. When flatTasks is alphabetically sorted the
 * resulting day_order assignments are incorrect and the server re-sort
 * produces the wrong order instead of the intended drop order.
 *
 * Fix: sort the captured list by day_order in handleDragStart before
 * storing it in preDragFlatTasksRef:
 *   preDragFlatTasksRef.current = boardColumns
 *     .flatMap((col) => col.tasks)
 *     .sort((a, b) => a.day_order - b.day_order);
 */

import { describe, it, expect } from "vitest";
import { computeReorderPairs } from "@/lib/utils/task-dnd";
import type { Task } from "@/lib/types/task";

const makeTask = (id: string, dayOrder: number, content: string): Task => ({
  id,
  user_id: "user1",
  project_id: null,
  parent_id: null,
  content,
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

describe("computeReorderPairs — alphabetic snap-back regression", () => {
  /**
   * Baseline: flatTasks in day_order order works correctly.
   *
   * Tasks (day_order order): Banana(d=0), Cherry(d=1), Apple(d=2)
   * User drags Cherry to top: orderedIds = ["cherry", "apple", "banana"]
   *
   * Slot walk: banana→idx0, cherry→idx1, apple→idx2
   * slots = [0,1,2], slotDayOrders = [0,1,2]
   * Assignment: cherry→0, apple→1, banana→2
   * Server sort asc: cherry(0), apple(1), banana(2) ✓ matches drop order.
   */
  it("produces correct day_orders when flatTasks is sorted by day_order (baseline)", () => {
    const flatTasksByDayOrder = [
      makeTask("banana", 0, "Banana"),
      makeTask("cherry", 1, "Cherry"),
      makeTask("apple", 2, "Apple"),
    ];

    const orderedIds = ["cherry", "apple", "banana"];
    const pairs = computeReorderPairs(orderedIds, flatTasksByDayOrder);

    expect(pairs.find((p) => p.id === "cherry")?.day_order).toBe(0);
    expect(pairs.find((p) => p.id === "apple")?.day_order).toBe(1);
    expect(pairs.find((p) => p.id === "banana")?.day_order).toBe(2);

    // Server sort asc by day_order matches intended drop order.
    const serverOrder = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(serverOrder[0].id).toBe("cherry");
    expect(serverOrder[1].id).toBe("apple");
    expect(serverOrder[2].id).toBe("banana");
  });

  /**
   * THE BUG: same scenario but flatTasks is in alphabetical display order
   * (pre-fix behavior when sortBy="alphabetical").
   *
   * flatTasks = [apple(d=2), banana(d=0), cherry(d=1)]  ← alphabetical, NOT day_order order
   *
   * Slot walk: apple→idx0(d=2), banana→idx1(d=0), cherry→idx2(d=1)
   * slots = [0,1,2], slotDayOrders = [2, 0, 1]
   *
   * orderedIds = ["cherry","apple","banana"]
   * Assignment: cherry→slotDayOrders[0]=2, apple→slotDayOrders[1]=0, banana→slotDayOrders[2]=1
   *
   * Server sort asc: apple(0), banana(1), cherry(2)
   * Intended: cherry first. Got: apple first. SNAP-BACK.
   */
  it("fix: non-monotonic slotDayOrders fall back to slot indices (alphabetical display order)", () => {
    // flatTasks in alphabetical DISPLAY order — slotDayOrders will be [2, 0, 1]
    // which is NOT strictly increasing → falls back to slot indices [0, 1, 2]
    const flatTasksAlphabetical = [
      makeTask("apple", 2, "Apple"), // idx0, day_order=2
      makeTask("banana", 0, "Banana"), // idx1, day_order=0
      makeTask("cherry", 1, "Cherry"), // idx2, day_order=1
    ];

    const orderedIds = ["cherry", "apple", "banana"];
    const pairs = computeReorderPairs(orderedIds, flatTasksAlphabetical);

    // slotDayOrders [2, 0, 1] is not strictly increasing → uses slot indices [0, 1, 2]
    // Assignment: cherry→0, apple→1, banana→2
    expect(pairs.find((p) => p.id === "cherry")!.day_order).toBe(0);
    expect(pairs.find((p) => p.id === "apple")!.day_order).toBe(1);
    expect(pairs.find((p) => p.id === "banana")!.day_order).toBe(2);

    // Server sort asc: cherry(0), apple(1), banana(2) — matches intended drop order ✓
    const serverOrder = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(serverOrder[0].id).toBe("cherry");
    expect(serverOrder[1].id).toBe("apple");
    expect(serverOrder[2].id).toBe("banana");
  });

  /**
   * THE FIX: sorting flatTasks by day_order before calling computeReorderPairs
   * corrects the assignment regardless of current display order.
   *
   * Same scenario — flatTasks captured alphabetically, then sorted:
   * [apple(d=2), banana(d=0), cherry(d=1)].sort → [banana(0), cherry(1), apple(2)]
   *
   * Slot walk: banana→idx0(d=0), cherry→idx1(d=1), apple→idx2(d=2)
   * slotDayOrders = [0,1,2]
   * Assignment: cherry→0, apple→1, banana→2
   * Server sort asc: cherry(0), apple(1), banana(2) ✓
   */
  it("fix: sorting flatTasks by day_order before computeReorderPairs corrects the bug", () => {
    const flatTasksAlphabetical = [
      makeTask("apple", 2, "Apple"),
      makeTask("banana", 0, "Banana"),
      makeTask("cherry", 1, "Cherry"),
    ];

    // THE FIX: sort by day_order ascending before passing to computeReorderPairs
    const flatTasksSorted = [...flatTasksAlphabetical].sort(
      (a, b) => a.day_order - b.day_order,
    );
    // flatTasksSorted: [banana(0), cherry(1), apple(2)]

    const orderedIds = ["cherry", "apple", "banana"];
    const pairs = computeReorderPairs(orderedIds, flatTasksSorted);

    expect(pairs.find((p) => p.id === "cherry")?.day_order).toBe(0);
    expect(pairs.find((p) => p.id === "apple")?.day_order).toBe(1);
    expect(pairs.find((p) => p.id === "banana")?.day_order).toBe(2);

    // Server sort asc: cherry(0), apple(1), banana(2) — matches intended drop order.
    const serverOrder = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(serverOrder[0].id).toBe("cherry");
    expect(serverOrder[1].id).toBe("apple");
    expect(serverOrder[2].id).toBe("banana");
  });

  /**
   * Cross-column DND with priority sort: task moved from one column lands
   * in correct position after the fix.
   *
   * Board: all four tasks sorted by priority for display:
   *   flatTasksDisplay = [taskC(p=1,d=2), taskA(p=2,d=0), taskD(p=3,d=3), taskB(p=4,d=1)]
   *
   * User drags taskC from col1 to col2, drops it before taskD.
   * After cross-column drop, orderedIds for col2 = ["taskC", "taskD", "taskB"]
   *
   * PRE-FIX bug: slots in display order
   *   taskC→idx0(d=2), taskD→idx2(d=3), taskB→idx3(d=1) → slotDayOrders=[2,3,1]
   *   Assignment: taskC→2, taskD→3, taskB→1
   *   Server asc: taskB(1), taskC(2), taskD(3) — not the intended order [taskC,taskD,taskB].
   *
   * POST-FIX: sort flat by day_order → [taskA(0),taskB(1),taskC(2),taskD(3)]
   *   slots of {taskC,taskD,taskB} at indices 2,3,1 → slotDayOrders=[1,2,3]
   *   Assignment: taskC→1, taskD→2, taskB→3
   *   Server asc: taskC(1), taskD(2), taskB(3) ✓ matches intended drop order.
   */
  it("cross-column: non-monotonic slotDayOrders fall back to slot indices (priority display order)", () => {
    // flatTasks in PRIORITY display order — slotDayOrders for the subset will be
    // [2, 3, 1] which is NOT strictly increasing → falls back to slot indices
    const flatTasksDisplayOrder = [
      makeTask("taskC", 2, "C"), // priority 1, idx0
      makeTask("taskA", 0, "A"), // priority 2, idx1
      makeTask("taskD", 3, "D"), // priority 3, idx2
      makeTask("taskB", 1, "B"), // priority 4, idx3
    ];

    // User drops taskC before taskD in col2 → desired col2 order: taskC, taskD, taskB
    const orderedIds = ["taskC", "taskD", "taskB"];

    // slotDayOrders [2, 3, 1] not strictly increasing → slot indices [0, 2, 3]
    const pairs = computeReorderPairs(orderedIds, flatTasksDisplayOrder);
    expect(pairs.find((p) => p.id === "taskC")?.day_order).toBe(0);
    expect(pairs.find((p) => p.id === "taskD")?.day_order).toBe(2);
    expect(pairs.find((p) => p.id === "taskB")?.day_order).toBe(3);

    // Server sort asc: taskC(0), taskD(2), taskB(3) — matches intended drop order
    const serverOrder = [...pairs].sort((a, b) => a.day_order - b.day_order);
    expect(serverOrder[0].id).toBe("taskC");
    expect(serverOrder[1].id).toBe("taskD");
    expect(serverOrder[2].id).toBe("taskB");

    // Also verify with pre-sorted flatTasks (handleDragStart sort fix)
    const flatTasksSorted = [...flatTasksDisplayOrder].sort(
      (a, b) => a.day_order - b.day_order,
    );
    // [taskA(0), taskB(1), taskC(2), taskD(3)] — strictly increasing → uses swap
    const pairsSorted = computeReorderPairs(orderedIds, flatTasksSorted);
    expect(pairsSorted.find((p) => p.id === "taskC")?.day_order).toBe(1);
    expect(pairsSorted.find((p) => p.id === "taskD")?.day_order).toBe(2);
    expect(pairsSorted.find((p) => p.id === "taskB")?.day_order).toBe(3);

    const sortedServerOrder = [...pairsSorted].sort(
      (a, b) => a.day_order - b.day_order,
    );
    expect(sortedServerOrder[0].id).toBe("taskC");
    expect(sortedServerOrder[1].id).toBe("taskD");
    expect(sortedServerOrder[2].id).toBe("taskB");
  });
});
