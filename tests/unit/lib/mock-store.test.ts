import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockStore } from "@/lib/mock/mock-store";

describe("MockStore (Guest Mode Data)", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store state
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty data when cleared", () => {
    const tasks = mockStore.getTasks();
    expect(tasks).toEqual([]);
  });

  it("should add a task and persist to localStorage", () => {
    const newTask = mockStore.addTask({
      content: "Test Task",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    expect(newTask.id).toBeDefined();
    expect(mockStore.getTasks()).toHaveLength(1);
    expect(mockStore.getTasks()[0].content).toBe("Test Task");

    // Verify localStorage
    const stored = JSON.parse(
      localStorage.getItem("kanso_guest_data_v8") || "{}",
    );
    expect(stored.tasks).toHaveLength(1);
    expect(stored.tasks[0].content).toBe("Test Task");
  });

  it("should update a task correctly", () => {
    const task = mockStore.addTask({
      content: "Original Content",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    const updated = mockStore.updateTask(task.id, {
      content: "Updated Content",
    });

    expect(updated).not.toBeNull();
    expect(updated?.content).toBe("Updated Content");
    expect(mockStore.getTask(task.id)?.content).toBe("Updated Content");

    // Verify localStorage
    const stored = JSON.parse(
      localStorage.getItem("kanso_guest_data_v8") || "{}",
    );
    expect(stored.tasks[0].content).toBe("Updated Content");
  });

  it("should return null when updating a non-existent task", () => {
    const result = mockStore.updateTask("non-existent-id", {
      content: "New Content",
    });
    expect(result).toBeNull();
  });
});
