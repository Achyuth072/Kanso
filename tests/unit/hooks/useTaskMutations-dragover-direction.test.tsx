import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Test to validate the fix for DND positioning bug
 *
 * Issue: When activeIndex < overIndex (visual shows "drop bottom"),
 * the current code uses arrayMove(oldIndex, overIndex).
 *
 * This might cause incorrect positioning.
 */

describe("DragOver Direction-Aware Positioning", () => {
  it("demonstrates the potential off-by-one when moving down", () => {
    // Scenario: User wants to drop between C and D
    // List: [A, B, C, D]
    // Dragging: B (index 1)
    // Visual indicates: hovering over C (index 2)
    // Visual dropLine: activeIndex(1) < overIndex(2) = "bottom"
    //
    // User expects: [A, C, B, D] -- B after C
    // But current code does: arrayMove(1, 2) → [A, C, B, D]
    //
    // Wait, that's correct! Let me recalculate...

    const items = ["A", "B", "C", "D"];
    const activeIndex = 1; // B
    const overIndex = 2; // C

    const dropLineShows = activeIndex < overIndex ? "bottom" : "top"; // "bottom"

    // Current code: arrayMove(oldIndex=1, newIndex=2)
    // Pre-remove: [A, B, C, D]
    // Remove B: [A, C, D]
    // Insert at 2: [A, C, B, D]
    // Result: B is at index 2, which is between C (1) and D (3) ✓

    const result = arrayMove(items, activeIndex, overIndex);
    expect(result).toEqual(["A", "C", "B", "D"]);
    expect(dropLineShows).toBe("bottom");

    // This appears to be correct!
  });

  it("tests moving down from end toward middle", () => {
    // Scenario: [A, B, C, D]
    // Drag: D (index 3)
    // Over: B (index 1)
    // Visual: activeIndex(3) > overIndex(1) = "top"
    //
    // User expects: [A, D, B, C]

    const items = ["A", "B", "C", "D"];
    const activeIndex = 3; // D
    const overIndex = 1; // B

    const dropLineShows = activeIndex < overIndex ? "bottom" : "top"; // "top"

    // Current code: arrayMove(oldIndex=3, newIndex=1)
    const result = arrayMove(items, activeIndex, overIndex);
    expect(result).toEqual(["A", "D", "B", "C"]);
    expect(dropLineShows).toBe("top");

    // Correct!
  });

  it("tests the potential bug: moving to end of list", () => {
    // Scenario: [A, B, C]
    // Drag: A (index 0)
    // Over: C (index 2)
    // Visual: activeIndex(0) < overIndex(2) = "bottom"
    // User expects: [B, C, A]

    const items = ["A", "B", "C"];
    const activeIndex = 0; // A
    const overIndex = 2; // C

    const dropLineShows = activeIndex < overIndex ? "bottom" : "top"; // "bottom"

    // Current code: arrayMove(0, 2)
    // Pre-remove: [A, B, C]
    // Remove A: [B, C]
    // Insert at 2: [B, C, A]
    // Result: [B, C, A] ✓

    const result = arrayMove(items, activeIndex, overIndex);
    expect(result).toEqual(["B", "C", "A"]);
    expect(dropLineShows).toBe("bottom");

    // Correct!
  });

  it("tests using dnd-kit's index directly vs findIndex", () => {
    // The issue might not be in the positioning logic itself,
    // but in HOW we calculate the index.
    //
    // Current: const overIndex = group.tasks.findIndex((t) => t.id === over.id);
    // Better: const overIndex = over.data.current?.sortable?.index;
    //
    // These should be the same in most cases, but dnd-kit's index is more reliable

    const items = ["A", "B", "C"];

    // Simulating findIndex calculation
    const overId = "B";
    const findIndexResult = items.findIndex((t) => t === overId); // 1

    // Simulating dnd-kit data
    const dndKitIndex = 1; // from over.data.current?.sortable?.index

    expect(findIndexResult).toBe(dndKitIndex);

    // In this simple case they match, but with rapid updates,
    // the state might be stale and findIndex could return a different result
  });

  it("identifies the REAL bug: findIndex uses stale state", () => {
    // The actual bug is likely a race condition:
    //
    // 1. handleDragOver fires with over.id = "B"
    // 2. Code calculates: overIndex = localGroups[x].tasks.findIndex(...) = 1
    // 3. Code calls: arrayMove(oldIndex, 1) and updates localGroups state
    // 4. React renders the new state
    // 5. ANOTHER handleDragOver fires before React finishes rendering
    // 6. But findIndex now calculates against the NEW localGroups
    // 7. The indices have shifted because localGroups was already updated!
    //
    // The fix: Use over.data.current?.sortable?.index from dnd-kit ALWAYS,
    // as it's based on the DOM, not on the stale React state

    // Simulate state drift:
    let localGroups = ["A", "B", "C", "D"];
    const active = "D";
    const over = "C"; // User hovering over C

    // First dragOver event
    const oldIndex1 = localGroups.findIndex((t) => t === active); // 3
    const newIndex1 = localGroups.findIndex((t) => t === over); // 2
    localGroups = arrayMove(localGroups, oldIndex1, newIndex1);
    // Now localGroups = ["A", "B", "D", "C"]

    // Second dragOver event comes in before React renders
    // User is now hovering over B
    const overNow = "B";
    const oldIndex2 = localGroups.findIndex((t) => t === active); // 2 (D's new position!)
    const newIndex2 = localGroups.findIndex((t) => t === overNow); // 1
    localGroups = arrayMove(localGroups, oldIndex2, newIndex2);
    // Now localGroups = ["A", "D", "B", "C"]

    expect(localGroups[0]).toBe("A");
    expect(localGroups[1]).toBe("D");
    expect(localGroups[2]).toBe("B");
    expect(localGroups[3]).toBe("C");

    // The indices are constantly shifting as we update the state!
    // This can cause incorrect positioning if the calculations are off.
  });
});
