/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { calculateNextDueDate } from "@/lib/utils/recurrence";

describe("calculateNextDueDate", () => {
  const originalDueDate = new Date("2026-05-01T12:00:00");
  const completionDate = new Date("2026-05-05T12:00:00");

  it("Flexible mode uses completion date as base (Default)", () => {
    const rule: any = { freq: "DAILY", interval: 1, mode: "flexible" };
    const nextDate = calculateNextDueDate(
      completionDate,
      rule,
      originalDueDate,
    );
    // 2026-05-05 + 1 day = 2026-05-06
    expect(nextDate.toISOString()).toContain("2026-05-06");
  });

  it("Strict mode uses original due date as base", () => {
    const rule: any = { freq: "DAILY", interval: 1, mode: "strict" };
    const nextDate = calculateNextDueDate(
      completionDate,
      rule,
      originalDueDate,
    );
    // 2026-05-01 + 1 day = 2026-05-02
    expect(nextDate.toISOString()).toContain("2026-05-02");
  });

  it("Legacy behavior (no mode) defaults to flexible", () => {
    const rule: any = { freq: "DAILY", interval: 1 };
    const nextDate = calculateNextDueDate(
      completionDate,
      rule,
      originalDueDate,
    );
    expect(nextDate.toISOString()).toContain("2026-05-06");
  });

  it("handles weekly recurrence in strict mode", () => {
    const rule: any = { freq: "WEEKLY", interval: 1, mode: "strict" };
    const nextDate = calculateNextDueDate(
      completionDate,
      rule,
      originalDueDate,
    );
    // 2026-05-01 + 1 week = 2026-05-08
    expect(nextDate.toISOString()).toContain("2026-05-08");
  });
});
