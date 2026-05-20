import { describe, it, expect } from "vitest";
import { arrayMove } from "@dnd-kit/sortable";

/**
 * Test to understand arrayMove semantics
 *
 * The bug report says tasks are placed "just below" the intended position.
 * This could mean arrayMove is behaving differently than expected.
 */

describe("arrayMove behavior", () => {
  it("should move element from oldIndex to newIndex", () => {
    // Setup: [A, B, C, D] at indices [0, 1, 2, 3]
    const items = ["A", "B", "C", "D"];

    // Move C (index 2) to position 0
    const result = arrayMove(items, 2, 0);

    // Expected: [C, A, B, D]
    expect(result).toEqual(["C", "A", "B", "D"]);
  });

  it("should handle moving forward", () => {
    const items = ["A", "B", "C", "D"];

    // Move A (index 0) to position 2
    const result = arrayMove(items, 0, 2);

    // Expected: [B, C, A, D]
    // OR: [B, A, C, D]? Need to verify
    expect(result.indexOf("A")).toBeGreaterThanOrEqual(2);
  });

  it("should handle moving down by one", () => {
    const items = ["A", "B", "C"];

    // Move A (index 0) to position 1
    const result = arrayMove(items, 0, 1);

    // If semantics: "move A to index 1" → [B, A, C]
    // If semantics: "move A to position after element at 1" → [B, A, C]
    expect(result).toEqual(["B", "A", "C"]);
  });

  it("should reveal off-by-one if newIndex means 'before' vs 'after'", () => {
    const items = ["A", "B", "C", "D"];

    // Scenario: User wants to place B after C (visually between C and D)
    // DND reports over.id = C, so overIndex = 2
    // If arrayMove(oldIndex=1, newIndex=2) means "move to index 2":
    //   Result: [A, C, B, D] → B is AT index 2, which is after C ✓
    // If arrayMove means something else, we get the bug

    const result = arrayMove(items, 1, 2);
    expect(result).toEqual(["A", "C", "B", "D"]);

    // Verify B is now at index 2
    expect(result.indexOf("B")).toBe(2);
  });

  it("should show bug if over-reporting causes extra increment", () => {
    const items = ["A", "B", "C"];

    // Desired: Move C (index 2) to position 1 (before B)
    // DND reports over.id = B, so overIndex = 1
    // Correct call: arrayMove(2, 1) → [A, C, B]
    // Buggy call: arrayMove(2, 1 + 1) → arrayMove(2, 2) → [A, B, C] (no move!)

    const result = arrayMove(items, 2, 1);
    expect(result).toEqual(["A", "C", "B"]);
  });
});
