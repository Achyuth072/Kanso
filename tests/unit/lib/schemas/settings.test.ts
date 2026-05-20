import { describe, it, expect } from "vitest";
import { FocusSettingsSchema } from "@/lib/schemas/settings";

describe("FocusSettingsSchema", () => {
  it("validates valid settings", () => {
    const input = {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreak: true,
      autoStartFocus: false,
    };
    const result = FocusSettingsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("fails if duration is too small", () => {
    const input = {
      focusDuration: 0,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    };
    const result = FocusSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.focusDuration).toContain(
        "Focus duration must be at least 1 minute",
      );
    }
  });

  it("fails if session count is out of range", () => {
    const input = {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 20,
    };
    const result = FocusSettingsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
