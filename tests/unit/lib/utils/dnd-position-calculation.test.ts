import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types/task";

describe("DND Position Calculation", () => {
  // Helper to create a task
  const makeTask = (id: string, order: number): Task => ({
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
    day_order: order,
    recurrence: null,
    google_event_id: null,
    google_etag: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  describe("Dropping at various positions", () => {
    it("should place task at position 0 when dropping before first task", () => {
      // Setup: [A, B, C] - dragging C to position 0 (before A)
      const tasks = [makeTask("A", 0), makeTask("B", 1), makeTask("C", 2)];

      // Simulate: over.id = "A" (first task), which gives us overIndex = 0
      const activeId = "C";
      const overId = "A";

      const activeIndex = tasks.findIndex((t) => t.id === activeId); // 2
      const overIndex = tasks.findIndex((t) => t.id === overId); // 0

      // Current logic
      const [movedTask] = tasks.splice(activeIndex, 1);
      tasks.splice(overIndex, 0, movedTask);

      // Result should be [C, A, B]
      expect(tasks[0].id).toBe("C");
      expect(tasks[1].id).toBe("A");
      expect(tasks[2].id).toBe("B");
    });

    it("should place task at last position when dropping after last task", () => {
      // Setup: [A, B, C] - dragging A to position 2 (after C)
      const tasks = [makeTask("A", 0), makeTask("B", 1), makeTask("C", 2)];

      // Simulate: over.id = "C" (last task), which gives us overIndex = 2
      const activeId = "A";
      const overId = "C";

      const activeIndex = tasks.findIndex((t) => t.id === activeId); // 0
      const overIndex = tasks.findIndex((t) => t.id === overId); // 2

      // Current logic: splice at 0, then splice at 2
      const [movedTask] = tasks.splice(activeIndex, 1); // [B, C]
      tasks.splice(overIndex, 0, movedTask); // inserts at position 2 → [B, C, A]

      // This is WRONG! Should be [B, C, A], which is correct...
      // But wait, if we want A after C, we should insert at index.length = 3
      expect(tasks.length).toBe(3);
      expect(tasks[0].id).toBe("B");
      expect(tasks[1].id).toBe("C");
      expect(tasks[2].id).toBe("A");
    });

    it("should place task in middle correctly", () => {
      // Setup: [A, B, C, D] - dragging D to position 1 (between A and B)
      const tasks = [
        makeTask("A", 0),
        makeTask("B", 1),
        makeTask("C", 2),
        makeTask("D", 3),
      ];

      // If user wants to drop between A and B, dnd-kit might:
      // - Report over.id = "B" (collision with B), so overIndex = 1
      // When we splice at index 1, we insert D before B: [A, D, B, C]
      const activeId = "D";
      const overId = "B";

      const activeIndex = tasks.findIndex((t) => t.id === activeId); // 3
      const overIndex = tasks.findIndex((t) => t.id === overId); // 1

      const [movedTask] = tasks.splice(activeIndex, 1); // [A, B, C]
      tasks.splice(overIndex, 0, movedTask); // [A, D, B, C]

      expect(tasks[0].id).toBe("A");
      expect(tasks[1].id).toBe("D");
      expect(tasks[2].id).toBe("B");
      expect(tasks[3].id).toBe("C");
    });

    it("should handle dropping on the same position (no-op)", () => {
      const tasks = [makeTask("A", 0), makeTask("B", 1), makeTask("C", 2)];

      // Dragging B over C (which has index 2)
      const activeId = "B";
      const overId = "C";

      const activeIndex = tasks.findIndex((t) => t.id === activeId); // 1
      const overIndex = tasks.findIndex((t) => t.id === overId); // 2

      const [movedTask] = tasks.splice(activeIndex, 1); // [A, C]
      tasks.splice(overIndex - 1, 0, movedTask); // Insert at adjusted position

      // Should be [A, B, C] after the move
      expect(tasks[0].id).toBe("A");
      expect(tasks[1].id).toBe("B");
      expect(tasks[2].id).toBe("C");
    });

    it("reveals the off-by-one bug when inserting after a task", () => {
      // BUG: When dragging B over C to place it AFTER C,
      // dnd-kit reports over.id = "C", but we want to insert AFTER C, not before it
      const tasks = [makeTask("A", 0), makeTask("B", 1), makeTask("C", 2)];

      const activeId = "B";
      const overId = "C"; // User wants B after C

      const activeIndex = tasks.findIndex((t) => t.id === activeId); // 1
      const overIndex = tasks.findIndex((t) => t.id === overId); // 2

      // Current buggy logic: splice(2, 0, B) puts B BEFORE C
      const [movedTask] = tasks.splice(activeIndex, 1); // [A, C]
      tasks.splice(overIndex, 0, movedTask); // [A, C, B] -- B is before C!

      // EXPECTED: [A, C, B] (B after C)
      // ACTUAL: [A, C, B] -- wait, that's right?

      // Oh! The issue might be in detecting WHETHER to insert before or after.
      // Need to check the DELTA position from dnd-kit

      expect(tasks[2].id).toBe("B"); // B is at position 2, C is at position 1
    });
  });

  describe("Cross-group insertion bug", () => {
    it("should handle inserting into a new group correctly", () => {
      // Group 1: [A, B]
      // Group 2: [C, D]
      // Move B to Group 2, placing it before C

      const group1 = [makeTask("A", 0), makeTask("B", 1)];
      const group2 = [makeTask("C", 2), makeTask("D", 3)];

      const activeId = "B";
      const overId = "C"; // Dragging B over C in group 2

      // Remove from group 1
      const activeIndex = group1.findIndex((t) => t.id === activeId); // 1
      const [movedTask] = group1.splice(activeIndex, 1); // [A]

      // Insert into group 2
      const overIndex = group2.findIndex((t) => t.id === overId); // 0
      group2.splice(overIndex, 0, movedTask); // [B, C, D]

      expect(group2[0].id).toBe("B");
      expect(group2[1].id).toBe("C");
      expect(group2[2].id).toBe("D");
    });

    it("reveals bug: inserting into empty section should place at position 0", () => {
      const group1 = [makeTask("A", 0), makeTask("B", 1)];
      const group2: Task[] = []; // Empty group

      const activeId = "B";

      // Remove from group 1
      const activeIndex = group1.findIndex((t) => t.id === activeId); // 1
      const [movedTask] = group1.splice(activeIndex, 1);

      // Insert into group 2 - but what is over.id if group 2 is empty?
      // dnd-kit might report over.id = "group2-title" instead
      // Let's assume overId is null/undefined
      const overIndex = group2.findIndex((t) => t.id === "nonexistent"); // -1
      const newIndex = overIndex >= 0 ? overIndex : group2.length; // 0

      group2.splice(newIndex, 0, movedTask);

      expect(group2[0].id).toBe("B");
      expect(group2.length).toBe(1);
    });
  });
});
