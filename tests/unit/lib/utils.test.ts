import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

describe("Utility Functions", () => {
  describe("cn (Utility Class Merger)", () => {
    it("merges tailwind classes correctly", () => {
      const result = cn("px-2 py-1", "bg-red-500", "px-4");
      expect(result).toContain("px-4");
      expect(result).not.toContain("px-2");
      expect(result).toContain("bg-red-500");
    });

    it("handles conditional classes", () => {
      const result = cn("base-class", true && "active", false && "inactive");
      expect(result).toBe("base-class active");
    });
  });

  describe("Date Formatting", () => {
    it("formats dates consistently", () => {
      const date = new Date("2024-01-01T12:00:00");
      expect(format(date, "yyyy-MM-dd")).toBe("2024-01-01");
    });
  });
});
