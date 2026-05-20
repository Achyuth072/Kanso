import { describe, it, expect } from "vitest";
import { parseEventInput } from "@/lib/utils/nlp-event";

describe("parseEventInput", () => {
  const refDate = new Date("2026-03-26T09:00:00Z"); // Fixed reference date for testing

  it('parses title and time correctly from "Lunch at 1pm tomorrow"', () => {
    const result = parseEventInput("Lunch at 1pm tomorrow", refDate);
    expect(result.title).toBe("Lunch");
    expect(result.allDay).toBe(false);
    // 1pm local time
    expect(result.start?.getHours()).toBe(13);
    // Default 1 hour duration
    expect(result.end?.getHours()).toBe(14);
  });

  it('parses explicit time range from "Meeting 2-4pm"', () => {
    const result = parseEventInput("Meeting 2-4pm", refDate);
    expect(result.title).toBe("Meeting");
    expect(result.allDay).toBe(false);
    expect(result.start?.getHours()).toBe(14); // 2pm
    expect(result.end?.getHours()).toBe(16); // 4pm
  });

  it('detects all-day events correctly from "Birthday on March 15"', () => {
    const result = parseEventInput("Birthday on March 15", refDate);
    expect(result.title).toBe("Birthday");
    expect(result.allDay).toBe(true);
    expect(result.start?.getMonth()).toBe(2); // March
    expect(result.start?.getDate()).toBe(15);
  });

  it("returns text as title when no date is found", () => {
    const result = parseEventInput("Go to the gym", refDate);
    expect(result.title).toBe("Go to the gym");
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
  });

  it("handles empty input gracefully", () => {
    const result = parseEventInput("", refDate);
    expect(result.title).toBe("");
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
  });
});
