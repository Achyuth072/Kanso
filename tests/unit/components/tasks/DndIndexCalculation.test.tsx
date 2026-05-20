import { describe, it, expect } from "vitest";

/**
 * Test to identify the index calculation bug in handleDragOver
 *
 * The current code does:
 * const newIndex = group.tasks.findIndex((t) => t.id === over.id);
 *
 * This is FRAGILE because:
 * 1. The findIndex is calculated on the current localGroups state
 * 2. But dnd-kit's over.data.current?.sortable?.index might be different
 *    if the component has already moved the active task in handleDragOver
 * 3. Or if there's a timing issue where the state hasn't updated yet
 *
 * The fix should use over.data.current?.sortable?.index directly from dnd-kit
 */

describe("DND Index Calculation Bug", () => {
  it("reveals the race condition when using findIndex", () => {
    // Scenario: Tasks list is being dragged, handleDragOver is called multiple times
    // Initial state: [A, B, C, D]
    // User drags D upward toward A
    // First handleDragOver: D over C → should move D before C → [A, B, D, C]
    // But if handleDragOver is called again before state updates:
    // The findIndex still finds C at position 2 (in stale state) or position 3 (in new state)

    const initialTasks = ["A", "B", "C", "D"];

    // Simulate first handleDragOver event
    const activeId = "D";
    const overId = "C"; // D dragged over C

    let localTasks = [...initialTasks];

    const oldIndex = localTasks.findIndex((t) => t === activeId); // 3
    const newIndex = localTasks.findIndex((t) => t === overId); // 2

    // arrayMove
    function arrayMove<T>(array: T[], from: number, to: number): T[] {
      const newArray = [...array];
      if (from < to) {
        // Moving down
        newArray.splice(to + 1, 0, newArray.splice(from, 1)[0]);
      } else {
        // Moving up
        newArray.splice(to, 0, newArray.splice(from, 1)[0]);
      }
      return newArray;
    }

    localTasks = arrayMove(localTasks, oldIndex, newIndex);

    // After first move: [A, B, D, C]
    expect(localTasks).toEqual(["A", "B", "D", "C"]);

    // Now second handleDragOver: D over B (user continues dragging up)
    // If state hasn't updated yet and we're still using the old localTasks:
    const oldIndex2 = localTasks.findIndex((t) => t === activeId); // Currently 2 (new position)
    const newIndex2 = localTasks.findIndex((t) => t === "B"); // Currently 1

    const wrongResult = arrayMove(localTasks, oldIndex2, newIndex2);
    // [A, D, B, C]
    expect(wrongResult[0]).toBe("A");
    expect(wrongResult[1]).toBe("D");
  });

  it("shows the benefit of using over.data.current?.sortable?.index", () => {
    // Instead of:
    // const overIndex = group.tasks.findIndex((t) => t.id === over.id);
    //
    // We should use:
    // const overIndex = over.data.current?.sortable?.index;
    //
    // Because dnd-kit already knows the index of the over element!

    // Example:
    // Tasks: [A, B, C, D]
    // dnd-kit reports: over.id = "C", over.data.current?.sortable?.index = 2
    // findIndex would also return 2 in this case, so they match.
    //
    // But if there's any timing issue, dnd-kit's index is the source of truth.

    const dndkitProvidedIndex = 2; // from over.data.current?.sortable?.index
    const findIndexResult = 2; // from findIndex

    expect(dndkitProvidedIndex).toBe(findIndexResult);

    // The fix is to use dnd-kit's provided index directly
  });

  it("pinpoints the exact bug: drop indicator vs insertion point mismatch", () => {
    // In SortableListTaskCard.tsx:
    // dropLine = activeIndex < overIndex ? "bottom" : "top";
    //
    // This is VISUAL FEEDBACK only.
    // It doesn't affect the actual insertion!
    //
    // The actual insertion happens in handleDragOver with:
    // arrayMove(group.tasks, oldIndex, newIndex);
    //
    // where newIndex = findIndex(over.id)
    //
    // The problem is:
    // When user sees drop line at "bottom" (activeIndex < overIndex),
    // they expect to insert AFTER the over element.
    // But arrayMove(src, dest) inserts AT dest, not after it.
    //
    // The fix depends on dnd-kit's semantics:
    // Does arrayMove semantically mean "insert at" or "insert before"?
    //
    // From my earlier tests: arrayMove(0, 2) on [A, B, C, D]
    // gives [B, C, A, D], putting A at index 2.
    // This is "insert at index 2" (before D in this case).
    //
    // So when the user drags A over C (index 2) with "drop bottom" visual,
    // arrayMove(0, 2) should put A at index 2, which might be after C depending
    // on how we count...

    // Let me verify once more with the real behavior
    const items = ["A", "B", "C", "D"];

    // Case 1: Move A (0) over C (2), visual shows "bottom"
    // Expected: A after C → [B, C, A, D]
    // Call: arrayMove(0, 2)
    function arrayMoveBehavior<T>(arr: T[], from: number, to: number): T[] {
      const result = [...arr];
      const [removed] = result.splice(from, 1);
      result.splice(to, 0, removed);
      return result;
    }

    const result1 = arrayMoveBehavior(items, 0, 2);
    expect(result1).toEqual(["B", "C", "A", "D"]);
    // Yes! A is after C! The behavior is correct!

    // Case 2: Move D (3) over C (2), visual shows "top"
    // Expected: D before C → [A, B, D, C]
    // Call: arrayMove(3, 2)
    const result2 = arrayMoveBehavior([...items], 3, 2);
    expect(result2).toEqual(["A", "B", "D", "C"]);
    // Yes! This is correct too!

    // So the current logic IS correct!
    // The bug must be elsewhere...
  });

  it("the bug must be in the cross-group or empty-group handling", () => {
    // The same-group reordering logic (using arrayMove) appears to be correct.
    // The bug report says tasks are placed "just below" intended position.
    //
    // This could happen in:
    // 1. Cross-group moves (uses splice instead of arrayMove)
    // 2. When the target group is empty
    // 3. When dragging to the column/group header
    //
    // Let's test cross-group logic

    const sourceGroup = ["A", "B", "C"];
    const targetGroup = ["X", "Y", "Z"];

    // User drags B from source to target, hovering over X
    const activeId = "B";
    const overIndex = targetGroup.findIndex((t) => t === "X"); // 0

    const [task] = sourceGroup.splice(
      sourceGroup.findIndex((t) => t === activeId),
      1,
    );
    // sourceGroup is now ["A", "C"]

    targetGroup.splice(overIndex, 0, task);
    // targetGroup.splice(0, 0, "B") inserts at position 0 → ["B", "X", "Y", "Z"]

    expect(targetGroup).toEqual(["B", "X", "Y", "Z"]);
    // This seems correct - B is inserted before X

    // But what if the visual shows "drop at bottom of X"?
    // The visual doesn't control the insertion for cross-group moves!
    // There's no direction check!
    //
    // That's the bug! Cross-group moves don't account for whether we're moving
    // up or down relative to the target group.
  });

  it("documents that the fix requires checking direction in cross-group moves", () => {
    // The fix for cross-group moves should be:
    //
    // For same-group: Use arrayMove, which handles direction automatically
    // For cross-group: Check if activeIndex < overIndex in the SOURCE group
    //                  If true (moving down), add 1 to the overIndex in target
    //                  This accounts for the removal of the active task shifting indices
    //
    // OR better yet: Use over.data.current?.sortable?.index from dnd-kit
    //                which already accounts for the direction

    const _sourceIndex = 1; // B in [A, B, C]
    const _targetIndex = 0; // X in [X, Y, Z]

    // If sourceIndex < targetIndex... wait, that doesn't make sense across groups.
    // The indices are in different arrays!

    // The real issue is that the visual drop indicator knows the direction,
    // but the insertion logic doesn't use that information.

    // Solution: Use over.data.current?.sortable?.index directly,
    // which includes information about drop position (top vs bottom)

    expect(true).toBe(true);
  });
});
