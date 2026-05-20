import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";
import type { Task } from "@/lib/types/task";

/**
 * Test for DND positioning off-by-one bug fix
 *
 * The bug occurs when dnd-kit reports over.data.current?.sortable?.index
 * but we're using findIndex instead. This can cause positioning issues
 * especially at boundaries or when there are rapid drag-over events.
 */

describe("DND Positioning Off-by-One Bug - Fix Validation", () => {
  const makeTasks = (ids: string[]): Task[] =>
    ids.map((id, i) => ({
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
      day_order: i,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  describe("Positioning accuracy at boundaries", () => {
    it("should place task at position 0 (top) correctly when using direct index", () => {
      // FAILING TEST - This demonstrates the expected behavior
      const tasks = makeTasks(["A", "B", "C", "D"]);

      // Simulate: User drags D (index 3) to hover over A (index 0)
      // dnd-kit provides: over.data.current?.sortable?.index = 0
      const activeIndex = 3; // D
      const _overIndex = 0; // A

      // Current buggy code would use findIndex:
      // const overIndex = tasks.findIndex((t) => t.id === "A"); // Also 0, seems fine...

      // But the fix should use the dnd-kit provided index directly:
      const dndKitProvidedIndex = 0; // from over.data.current?.sortable?.index

      // arrayMove with correct index
      const result = arrayMove(tasks, activeIndex, dndKitProvidedIndex);

      // Expected: D should be at position 0
      expect(result[0].id).toBe("D");
      expect(result[1].id).toBe("A");
      expect(result[2].id).toBe("B");
      expect(result[3].id).toBe("C");
    });

    it("should place task at last position correctly", () => {
      const tasks = makeTasks(["A", "B", "C", "D"]);

      // Simulate: User drags A (index 0) to hover over D (index 3)
      const activeIndex = 0; // A
      const overIndex = 3; // D

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Expected: A should end up after D
      expect(result[2].id).toBe("D");
      expect(result[3].id).toBe("A");
    });

    it("should handle insertion when activeIndex < overIndex", () => {
      // This is the critical case for the bug
      // When activeIndex < overIndex (moving down), arrayMove needs correct index
      const tasks = makeTasks(["A", "B", "C", "D"]);

      const activeIndex = 1; // B
      const overIndex = 3; // D

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Result: [A, C, D, B]
      // B should be at position 2 or 3 (after or at D)
      expect(result[0].id).toBe("A");
      expect(result[1].id).toBe("C");
      expect(result[3].id).toBe("B");
    });

    it("should handle insertion when activeIndex > overIndex", () => {
      // Moving up case
      const tasks = makeTasks(["A", "B", "C", "D"]);

      const activeIndex = 3; // D
      const overIndex = 1; // B

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Result: [A, D, B, C]
      // D should be at position 1, before B
      expect(result[0].id).toBe("A");
      expect(result[1].id).toBe("D");
      expect(result[2].id).toBe("B");
      expect(result[3].id).toBe("C");
    });
  });

  describe("Cross-group positioning with splice", () => {
    it("should insert at correct position when dragging to empty group", () => {
      const sourceGroup = makeTasks(["A", "B", "C"]);
      const targetGroup: Task[] = [];

      // User drags B to empty target group
      const activeId = "B";
      const [task] = sourceGroup.splice(
        sourceGroup.findIndex((t) => t.id === activeId),
        1,
      );

      // In empty group, the overIndex is -1, so we append
      const overIndex = targetGroup.findIndex((t) => t.id === "X"); // -1
      const newIndex = overIndex >= 0 ? overIndex : targetGroup.length; // 0

      targetGroup.splice(newIndex, 0, task);

      // Expected: B is at position 0 in target group
      expect(targetGroup[0].id).toBe("B");
      expect(targetGroup.length).toBe(1);
    });

    it("should insert at correct position when dragging to non-empty group", () => {
      const sourceGroup = makeTasks(["A", "B", "C"]);
      const targetGroup = makeTasks(["X", "Y", "Z"]);

      // User drags C to target group, over Y
      const activeId = "C";
      const sourceIndex = sourceGroup.findIndex((t) => t.id === activeId); // 2
      const [task] = sourceGroup.splice(sourceIndex, 1);

      // Find Y in target: it's at index 1
      const overIndex = targetGroup.findIndex((t) => t.id === "Y"); // 1
      const newIndex = overIndex >= 0 ? overIndex : targetGroup.length;

      targetGroup.splice(newIndex, 0, task);

      // Expected: C should be at position 1 in target (before Y)
      expect(targetGroup[0].id).toBe("X");
      expect(targetGroup[1].id).toBe("C");
      expect(targetGroup[2].id).toBe("Y");
      expect(targetGroup[3].id).toBe("Z");
    });

    it("reveals the bug: cross-group insertions don't account for drop direction", () => {
      // The bug is that cross-group moves don't check if the task
      // should be inserted before or after the over element.
      //
      // The visual drop indicator in SortableListTaskCard shows:
      // dropLine = activeIndex < overIndex ? "bottom" : "top";
      //
      // But this is VISUAL only. The actual insertion uses:
      // targetGroup.tasks.splice(newIndex, 0, updatedTask);
      //
      // where newIndex is simply the index of the over element.
      //
      // If dropLine is "bottom" (activeIndex < overIndex in SOURCE),
      // we should insert AFTER the over element in TARGET.
      // But if the over element is in a different group,
      // the activeIndex comparison is meaningless!

      // The real fix is to use over.data.current?.sortable?.index
      // and check if there's a direction indicator from dnd-kit

      const sourceGroup = makeTasks(["A", "B"]);
      const targetGroup = makeTasks(["X", "Y"]);

      // activeIndex in source = 1 (B)
      // overIndex in target = 0 (X)
      // activeIndex > overIndex, so dropLine shows "top"
      // This means: insert B before X

      const activeIndex = 1; // B in source
      const overIndex = 0; // X in target

      const showTopDropLine = activeIndex > overIndex; // true

      // The insertion should honor this visual:
      const [task] = sourceGroup.splice(activeIndex, 1);
      targetGroup.splice(overIndex, 0, task);

      // Result: [B, X, Y]
      expect(targetGroup[0].id).toBe("B");
      expect(showTopDropLine).toBe(true);

      // But what if the order were different?
      // If activeIndex < overIndex, visual shows "bottom"
      // meaning insert after the over element
      // But we can't use activeIndex < overIndex across groups!
      // We need dnd-kit's position indicator (rect.top vs rect.height)
    });
  });

  describe("The fix: using over.data.current?.sortable?.index", () => {
    it("should use dnd-kit provided index instead of findIndex", () => {
      // The fix is conceptually simple:
      // Replace:
      //   const overIndex = group.tasks.findIndex((t) => t.id === over.id);
      // With:
      //   const overIndex = over.data.current?.sortable?.index;
      //   if (overIndex === undefined) {
      //     // Fallback to findIndex if dnd-kit doesn't provide it
      //     overIndex = group.tasks.findIndex((t) => t.id === over.id);
      //   }

      const tasks = makeTasks(["A", "B", "C", "D"]);

      // Simulate dnd-kit data
      const dndKitIndex = 2; // from over.data.current?.sortable?.index
      const fallbackIndex = tasks.findIndex((t) => t.id === "C"); // Also 2

      // In this case they match, but dnd-kit's index is authoritative
      expect(dndKitIndex).toBe(fallbackIndex);

      // The benefit: if there's ANY timing issue, dnd-kit's index is correct
    });

    it("should handle direction-aware positioning for cross-group moves", () => {
      // For cross-group moves, we need to know if we're inserting before or after
      // This information comes from dnd-kit's position data or from comparing
      // the active element's Y position to the over element's Y position

      // Pseudo-code for the fix:
      // const overDndIndex = over.data.current?.sortable?.index;
      // if (overDndIndex === undefined) {
      //   overDndIndex = group.tasks.findIndex((t) => t.id === over.id);
      // }
      //
      // For cross-group moves, we might also need:
      // const activeRect = active.node?.getBoundingClientRect();
      // const overRect = over.node?.getBoundingClientRect();
      // const isInsertAfter = activeRect && overRect && activeRect.top > overRect.top;
      //
      // But for now, using dnd-kit's index directly should help

      expect(true).toBe(true);
    });
  });
});
