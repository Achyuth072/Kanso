import { describe, it, expect } from "vitest";
import { CreateProjectSchema } from "@/lib/schemas/project";

describe("CreateProjectSchema", () => {
  it("validates a standard project", () => {
    const input = {
      name: "Work",
      color: "#FF0000",
      view_style: "list",
    };
    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails if name is empty", () => {
    const input = {
      name: "",
      color: "#FF0000",
    };
    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Project name is required",
      );
    }
  });

  it("fails if name is too long (> 50 chars)", () => {
    const input = {
      name: "a".repeat(51),
      color: "#FF0000",
    };
    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails if color is invalid hex", () => {
    const input = {
      name: "Work",
      color: "invalid-hex",
    };
    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.color).toContain(
        "Invalid hex color",
      );
    }
  });

  it("fails if color or view_style is missing", () => {
    const input = {
      name: "Work",
    };
    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts valid short hex color", () => {
    const input = {
      name: "Work",
      color: "#F00",
      view_style: "list" as const,
    };

    const result = CreateProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
