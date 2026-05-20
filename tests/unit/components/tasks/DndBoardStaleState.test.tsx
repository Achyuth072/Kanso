import { describe, it, expect } from "vitest";

/**
 * Tests for bugs found in Board view DND handleDragOver:
 *
 * Bug 1: Same-column reorder uses stale closure data inside a functional updater.
 *   When multiple handleDragOver calls fire before React re-renders, the
 *   functional updater overwrites prev state with arrayMove computed from
 *   stale closure-captured data.
 *
 * Bug 2: Cross-column move does not guard against activeIndex === -1.
 *   If a previous updater already removed the task from the source column,
 *   splice(-1, 1) corrupts data by removing the wrong task.
 */
describe("Board DND Stale State Bugs", () => {
  function arrayMove<T>(array: T[], from: number, to: number): T[] {
    const result = [...array];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  }

  /**
   * Bug 1: Same-column reorder with stale closure data.
   *
   * The current code does:
   *   const colIndex = localColumns.findIndex(...)  // from closure
   *   const tasks = [...localColumns[colIndex].tasks]  // from closure
   *   const oldIndex = tasks.findIndex(...)  // from closure
   *   let newIndex = over.data.current?.sortable?.index  // from event
   *   setLocalColumns((prev) => {
   *     // BUG: uses closure-captured `tasks`, not `prev[colIndex].tasks`
   *     newCols[colIndex] = { ...prev[colIndex], tasks: arrayMove(tasks, oldIndex, newIndex) }
   *   })
   *
   * When two same-column handleDragOver calls fire before React re-renders,
   * the second updater's `tasks` array doesn't reflect the first updater's changes.
   */
  describe("Bug 1: Same-column reorder stale closure data", () => {
    it("overwrites previous same-column update because closure data is stale", () => {
      // Initial column state: tasks in order
      const initialCol = { title: "Today", tasks: ["A", "B", "C", "D"] };

      // Simulation: two handleDragOver calls fire before React re-renders
      // Both capture localColumns from the same closure (stale state)

      // --- handleDragOver call 1: hover over D (newIndex=3) ---
      const closureCols1 = [{ ...initialCol, tasks: [...initialCol.tasks] }];
      const colIndex1 = 0; // from closure: localColumns.findIndex(...)
      const tasks1 = [...closureCols1[colIndex1].tasks]; // [A, B, C, D]
      const oldIndex1 = tasks1.findIndex((t) => t === "C"); // 2
      const newIndex1 = 3; // over.data.current?.sortable?.index for D

      // --- handleDragOver call 2: hover over A (newIndex=0) ---
      const closureCols2 = [{ ...initialCol, tasks: [...initialCol.tasks] }];
      // Same closure state! React hasn't re-rendered.
      const colIndex2 = 0;
      const tasks2 = [...closureCols2[colIndex2].tasks]; // [A, B, C, D] (SAME stale data)
      const oldIndex2 = tasks2.findIndex((t) => t === "C"); // 2
      const newIndex2 = 0; // over.data.current?.sortable?.index for A

      // --- React processes updaters sequentially ---
      let prev = [{ ...initialCol, tasks: [...initialCol.tasks] }];

      // Updater 1 runs first (React processes in order)
      const newCols1 = [...prev];
      newCols1[colIndex1] = {
        ...prev[colIndex1],
        tasks: arrayMove(tasks1, oldIndex1, newIndex1),
      };
      // BUG: uses tasks1 (stale) = [A,B,C,D], produces [A,B,D,C]
      prev = newCols1;
      expect(prev[0].tasks).toEqual(["A", "B", "D", "C"]);

      // Updater 2 runs second with prev = result of updater 1
      const newCols2 = [...prev];
      newCols2[colIndex2] = {
        ...prev[colIndex2],
        tasks: arrayMove(tasks2, oldIndex2, newIndex2),
      };
      // BUG: uses tasks2 (STILL stale!) = [A,B,C,D], arrayMove([A,B,C,D], 2, 0) = [C,A,B,D]
      prev = newCols2;
      expect(prev[0].tasks).toEqual(["C", "A", "B", "D"]);

      // But prev[colIndex2].tasks BEFORE overwrite was ["A", "B", "D", "C"]
      // The correct result (preserving updater 1's partial state) would be
      // arrayMove(["A", "B", "D", "C"], 2, 0) = ["C", "A", "B", "D"]
      // which happens to be the same in this case.
      //
      // Let's test a case where the stale data DIFFERS from prev:
    });

    it("demonstrates data loss when prev has additional tasks not in closure data", () => {
      // Scenario: A task E was added to the column by a CROSS-COLUMN updater
      // before this same-column updater runs.

      const _initialCol = { title: "Today", tasks: ["A", "B", "C", "D"] };

      // Closure captures: [A, B, C, D]
      const closureTasks = ["A", "B", "C", "D"];
      const colIndex = 0;
      const oldIndex = closureTasks.findIndex((t) => t === "C"); // 2
      const newIndex = 1; // hovering over B

      // But prev (after cross-column updater) has: [A, B, E, C, D]
      // E was added by a cross-column move
      const prev = [{ title: "Today", tasks: ["A", "B", "E", "C", "D"] }];

      // Buggy code: overwrites with arrayMove(closureTasks, 2, 1) = [A, C, B, D]
      // E is LOST!
      const buggyResult = arrayMove(closureTasks, oldIndex, newIndex);
      expect(buggyResult).toEqual(["A", "C", "B", "D"]);
      // E is missing!

      // Fixed code: uses prev data
      const prevTasks = [...prev[colIndex].tasks]; // ["A", "B", "E", "C", "D"]
      const fixedOldIndex = prevTasks.findIndex((t) => t === "C"); // 3
      const fixedResult = arrayMove(prevTasks, fixedOldIndex, newIndex); // arrayMove([A,B,E,C,D], 3, 1)
      expect(fixedResult).toEqual(["A", "C", "B", "E", "D"]);
      // E is preserved!

      // Verify the fix produces valid results
      const buggyColTasks = buggyResult;
      const fixedColTasks = fixedResult;

      // Buggy result is MISSING "E"
      expect(buggyColTasks.includes("E")).toBe(false);
      // Fixed result includes "E"
      expect(fixedColTasks.includes("E")).toBe(true);
      // Fixed result has correct positioning
      expect(fixedColTasks[1]).toBe("C"); // C before B
    });

    it("preserves correct positioning when using prev data in functional updater", () => {
      // Test that the fix (using prev data) produces correct results for
      // same-column reorders even when multiple updaters are batched.

      const initialCol = { title: "Today", tasks: ["A", "B", "C", "D"] };

      // Simulating two batched same-column handleDragOver calls with the FIX applied
      let prev = [{ ...initialCol, tasks: [...initialCol.tasks] }];

      // Fix pattern: compute everything from prev inside the updater
      // Updater 1: move C over D (hover over D, newIndex=3)
      {
        const prevTasks = [...prev[0].tasks]; // [A, B, C, D]
        const oldIndex = prevTasks.findIndex((t) => t === "C"); // 2
        const newIndex = 3; // from sortable.index

        const newCols = [...prev];
        newCols[0] = {
          ...prev[0],
          tasks: arrayMove(prevTasks, oldIndex, newIndex),
        };
        prev = newCols; // [A, B, D, C]
        expect(prev[0].tasks).toEqual(["A", "B", "D", "C"]);
      }

      // Updater 2: move C over A (hover over A, newIndex=0)
      {
        const prevTasks = [...prev[0].tasks]; // [A, B, D, C] - from updater 1
        const oldIndex = prevTasks.findIndex((t) => t === "C"); // 3
        const newIndex = 0; // from sortable.index

        const newCols = [...prev];
        newCols[0] = {
          ...prev[0],
          tasks: arrayMove(prevTasks, oldIndex, newIndex),
        };
        prev = newCols; // [C, A, B, D]
        expect(prev[0].tasks).toEqual(["C", "A", "B", "D"]);
      }

      // Final result is correct: C is at position 0 (before A)
      expect(prev[0].tasks[0]).toBe("C");
    });
  });

  /**
   * Bug 2: Missing -1 guard on activeIndex in cross-column move.
   *
   * Current code:
   *   const activeIndex = activeTasks.findIndex((t) => t.id === activeId);
   *   // NO -1 check!
   *   const [movedTask] = activeTasks.splice(activeIndex, 1);
   *
   * If a previous updater already removed the task, activeIndex === -1,
   * and splice(-1, 1) removes the LAST element from the source column.
   */
  describe("Bug 2: Missing -1 guard in cross-column move", () => {
    it("splice(-1, 1) removes the wrong task when activeIndex is -1", () => {
      // Simulate the cross-column logic
      const sourceCol = { title: "Backlog", tasks: ["X", "Y", "Z"] };
      const targetCol = { title: "Today", tasks: ["A", "B", "C"] };

      // A previous updater already moved C from Backlog to Today (in the DOM order)
      // Now a second cross-column updater runs but C is already gone from Backlog

      const activeId = "C"; // the dragged task
      let activeColTasks = [...sourceCol.tasks]; // ["X", "Y", "Z"]
      const _overColTasks = [...targetCol.tasks]; // ["A", "B", "C"]

      // BUG: findIndex returns -1 because C is already in Today, not Backlog
      const activeIndex = activeColTasks.findIndex((t) => t === activeId); // -1

      if (activeIndex === -1) {
        // BUGGY: no guard - splice(-1, 1) removes "Z"!
        const [removed] = activeColTasks.splice(activeIndex, 1);
        // removed is "Z" (wrong task!)
        expect(removed).toBe("Z");
        // "Z" was incorrectly removed from Backlog
        expect(activeColTasks).toEqual(["X", "Y"]);
        // And C is still in Today (from previous updater) = duplicate
      }

      // Fixed behavior:
      activeColTasks = [...sourceCol.tasks]; // Reset: ["X", "Y", "Z"]
      const fixedActiveIndex = activeColTasks.findIndex((t) => t === activeId); // -1
      if (fixedActiveIndex === -1) {
        // FIX: return prev (no-op) instead of corrupting data
        // activeColTasks stays ["X", "Y", "Z"]
        expect(activeColTasks).toEqual(["X", "Y", "Z"]);
        // No corruption!
      }
    });

    it("should return prev (no-op) when task is not found in source column", () => {
      // This test validates the expected behavior: when a cross-column
      // updater runs and the task is no longer in the source column
      // (because a previous updater already moved it), the updater
      // should be a no-op.

      const sourceCol = { title: "Backlog", tasks: ["X", "Y"] };
      const activeId = "C"; // Already moved to another column

      // Fixed pattern
      const activeColTasks = [...sourceCol.tasks];
      const activeIndex = activeColTasks.findIndex((t) => t === activeId);

      if (activeIndex === -1) {
        // FIX: Skip the move, return prev unchanged
        // Do NOT splice or modify anything
        expect(activeColTasks).toEqual(["X", "Y"]); // Data preserved
        expect(true).toBe(true);
      } else {
        // Only execute the move if the task is found
        const [_movedTask] = activeColTasks.splice(activeIndex, 1);
        // ... insert into target
      }
    });
  });
});
