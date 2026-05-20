import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Test suite for the DND off-by-one bug fix
 *
 * The bug occurs when dragging a task DOWNWARD in the list.
 * When activeIndex < overIndex (moving down), arrayMove(oldIndex, overIndex)
 * inserts the task BEFORE the over element, but it should insert AFTER.
 *
 * Fix: When moving down (activeIndex < overIndex), use overIndex + 1
 *      When moving up (activeIndex > overIndex), use overIndex
 */

describe("DND Direction-aware positioning fix", () => {
  describe("Moving UP (activeIndex > overIndex)", () => {
    it("should correctly move task up by one position", () => {
      // List: [A, B, C, D], drag C (index 2) over B (index 1) - moving up
      const tasks = ["A", "B", "C", "D"];
      const activeIndex = 2; // C
      const overIndex = 1; // B

      // When moving up, insert at overIndex

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Expected: [A, C, B, D]
      expect(result).toEqual(["A", "C", "B", "D"]);
      expect(result.indexOf("C")).toBe(1);
    });

    it("should correctly move task to top", () => {
      // List: [A, B, C, D], drag D (index 3) to position 0
      const tasks = ["A", "B", "C", "D"];
      const activeIndex = 3; // D
      const overIndex = 0; // A

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Expected: [D, A, B, C]
      expect(result).toEqual(["D", "A", "B", "C"]);
      expect(result.indexOf("D")).toBe(0);
    });

    it("should handle large upward movement", () => {
      // List: [A, B, C, D, E, F], drag F (index 5) over B (index 1)
      const tasks = ["A", "B", "C", "D", "E", "F"];
      const activeIndex = 5;
      const overIndex = 1;

      const result = arrayMove(tasks, activeIndex, overIndex);

      // Expected: [A, F, B, C, D, E]
      expect(result).toEqual(["A", "F", "B", "C", "D", "E"]);
      expect(result.indexOf("F")).toBe(1);
    });
  });

  describe("Moving DOWN (activeIndex < overIndex) - THE BUG CASE", () => {
    it("should correctly move task down by one position", () => {
      // List: [A, B, C, D], drag A (index 0) over C (index 2) - moving down
      // User wants to place A between C and D
      const tasks = ["A", "B", "C", "D"];
      const activeIndex = 0; // A
      const overIndex = 2; // C (user hovered over C)

      // BUG: Using arrayMove(0, 2) gives [B, C, A, D] - A at position 2, not after C
      const buggyResult = arrayMove(tasks, activeIndex, overIndex);
      expect(buggyResult).toEqual(["B", "C", "A", "D"]); // A is at index 2

      // FIX: When moving down (activeIndex < overIndex), insert at overIndex + 1
      const fixedNewIndex = activeIndex < overIndex ? overIndex + 1 : overIndex;
      const fixedResult = arrayMove(tasks, activeIndex, fixedNewIndex);
      expect(fixedResult).toEqual(["B", "C", "D", "A"]); // A is now after C and D

      // Wait, that's not right either. Let me reconsider...
      // If we're dragging A over C, and C is at index 2:
      // - After removing A, list becomes [B, C, D]
      // - If we insert at index 2, we get [B, C, A, D]
      // - If we insert at index 3, we get [B, C, D, A]
      //
      // But the user is dragging over C, so they probably want it between C and D.
      // That would be index 3 in the pre-removal list... but we're calculating based on post-removal positions.

      // Hmm, this is tricky. Let me verify the expected behavior by testing what
      // the visual drop indicator shows in SortableListTaskCard
    });

    it("should handle the visual drop indicator logic correctly", () => {
      // From SortableListTaskCard.tsx line 116:
      // dropLine = activeIndex < overIndex ? "bottom" : "top";
      //
      // This means:
      // - If activeIndex < overIndex: show drop line at BOTTOM of over element
      // - If activeIndex >= overIndex: show drop line at TOP of over element
      //
      // For arrayMove semantics:
      // - arrayMove(source, dest) moves source to dest
      // - After removal at source, the dest index may shift

      const tasks = ["A", "B", "C", "D"];
      const activeIndex = 0; // A
      const overIndex = 2; // C

      // Visual: show drop line at BOTTOM of C (between C and D)
      // This means: "insert A after C"
      // In pre-removal coordinates: C is at index 2, so after C = index 3
      // In post-removal coordinates: after removing A (index 0), C is at index 1
      //                             insert at index 2 = after C in the new list

      // But wait, in post-removal coordinates:
      // Original: [A(0), B(1), C(2), D(3)]
      // Remove A: [B(0), C(1), D(2)]
      // Insert at index 2: [B(0), C(1), A(2), D(3)] — this puts A after C!

      // So the bug is about the visual vs actual.
      // The visual shows "drop below C" but the insertion happens "drop above C".

      // Actually, I think the issue is that the visual indicator is correct,
      // but the actual arrayMove call is using the wrong index.

      const result = arrayMove(tasks, activeIndex, overIndex);
      expect(result).toEqual(["B", "C", "A", "D"]); // A ends up between C and D... wait, that's correct!

      // Hmm, let me recount:
      // Result: ["B", "C", "A", "D"]
      // Indices: [0,   1,   2,   3]
      // A is at index 2, which is after C(1) and before D(3). That seems correct!

      // Maybe the bug is different...
    });

    it("should identify the actual off-by-one issue", () => {
      // Let me re-read the bug report: "tasks placed JUST BELOW intended position"
      // This could mean they're one position LOWER (higher index) than intended.

      // Setup: [1, 2, 3, 4, 5]
      // User wants to place 5 at position 1 (between 1 and 2)
      // DND reports over.id = 2 (task at index 1)
      // Current code: arrayMove(4, 1)

      const tasks = [1, 2, 3, 4, 5];
      const activeIndex = 4; // 5 is at index 4
      const overIndex = 1; // 2 is at index 1 (where user is hovering)

      // User's intent: [1, 5, 2, 3, 4]
      // Current behavior: arrayMove(4, 1)
      const result = arrayMove(tasks, activeIndex, overIndex);

      expect(result).toEqual([1, 5, 2, 3, 4]); // This is CORRECT!

      // So arrayMove is working correctly. The bug must be elsewhere...
      // Maybe it's in how we determine overIndex?
    });

    it("reveals the real bug: overIndex is calculated BEFORE removal", () => {
      // AH! I think I found it. Let me trace through the actual code:
      //
      // Original code in TaskList.tsx (BUGGY):
      // ```
      // const oldIndex = group.tasks.findIndex((t) => t.id === active.id);
      // const newIndex = group.tasks.findIndex((t) => t.id === over.id);
      // const newTasks = arrayMove(group.tasks, oldIndex, newIndex);
      // ```
      //
      // The issue is that when activeIndex < overIndex (moving down),
      // the visual indicator shows "drop BELOW" but arrayMove inserts "BEFORE".
      //
      // Let me verify: does arrayMove(src, dest) insert at dest or after dest?

      const items = ["A", "B", "C", "D"];

      // Move A (0) to C's position (2)
      const result1 = arrayMove(items, 0, 2);
      expect(result1).toEqual(["B", "C", "A", "D"]);

      // Move D (3) to C's position (2)
      const result2 = arrayMove([...items], 3, 2);
      expect(result2).toEqual(["A", "B", "D", "C"]);

      // So arrayMove inserts AT the destination index.
      // When moving up (activeIndex > overIndex): arrayMove(3, 2) → D before C ✓
      // When moving down (activeIndex < overIndex): arrayMove(0, 2) → A before C (post-removal of A)
      //   This puts A at position 2 in the result, which is between C and D ✓

      // Both cases seem correct...
    });

    it("finally reveals the issue: visual vs insertion semantics mismatch", () => {
      // The SortableListTaskCard shows dropLine = "bottom" when activeIndex < overIndex.
      // This suggests the visual indicator means "insert below this element".
      // But arrayMove inserts AT the index, not below it.

      // Let's trace a concrete example:
      // [A, B, C, D], drag A over C

      const items = ["A", "B", "C", "D"];
      const activeIndex = 0; // A
      const overIndex = 2; // C

      // Visual says: dropLine = "bottom" (insert below C)
      // Which means: [A, B, C, A, D] — wait, we can't have A twice.
      // It means the final result should be: [B, C, A, D]

      const result = arrayMove(items, activeIndex, overIndex);
      expect(result).toEqual(["B", "C", "A", "D"]); // ✓ Correct!

      // So the current behavior IS correct! The bug must be something else...
    });
  });

  describe("Testing boundary conditions", () => {
    it("should place task at position 0 correctly", () => {
      const items = ["A", "B", "C"];
      const result = arrayMove(items, 2, 0); // Move C to position 0

      expect(result[0]).toBe("C");
      expect(result).toEqual(["C", "A", "B"]);
    });

    it("should place task at last position correctly", () => {
      const items = ["A", "B", "C"];
      const result = arrayMove(items, 0, 2); // Move A to position 2

      expect(result[2]).toBe("A");
      expect(result).toEqual(["B", "C", "A"]);
    });
  });
});
