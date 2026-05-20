import { describe, it, expect } from "vitest";
import { TaskSchema, UpdateTaskSchema } from "@/lib/schemas/task";

describe("Task Schema Validation", () => {
  it("should pass validation for non-UUID id in TaskSchema (Guest Mode support)", () => {
    const validGuestTask = {
      id: "guest-task-12345",
      user_id: "guest",
      content: "Test",
      priority: 4,
      is_completed: false,
      day_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // other fields optional/nullable
    };

    const result = TaskSchema.safeParse(validGuestTask);
    expect(result.success).toBe(true);
  });

  it("should pass validation for non-UUID id in UpdateTaskSchema (Guest Mode support)", () => {
    const validGuestUpdate = {
      id: "guest-task-12345",
      content: "Updated",
    };

    const result = UpdateTaskSchema.safeParse(validGuestUpdate);
    expect(result.success).toBe(true);
  });
});
