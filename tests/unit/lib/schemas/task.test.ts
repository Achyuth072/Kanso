import { describe, it, expect } from "vitest";
import { CreateTaskSchema } from "@/lib/schemas/task";

describe("CreateTaskSchema", () => {
  it("validates a correct task input", () => {
    const input = {
      content: "Test Task",
      priority: 1,
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails if content is empty", () => {
    const input = {
      content: "",
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.content).toContain("Task content is required");
    }
  });

  it("fails if content is too long", () => {
    const input = {
      content: "a".repeat(501),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("validates with a Date object for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: new Date(),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates with do_date and is_evening", () => {
    const input = {
      content: "Test Task",
      do_date: new Date(),
      is_evening: true,
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("validates with a valid datetime string for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: new Date().toISOString(),
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails with an invalid datetime string for due_date", () => {
    const input = {
      content: "Test Task",
      due_date: "not-a-date",
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
  it("validates with a valid recurrence object", () => {
    const input = {
      content: "Recurring Task",
      recurrence: {
        freq: "DAILY",
        interval: 1,
      },
    };
    const result = CreateTaskSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
