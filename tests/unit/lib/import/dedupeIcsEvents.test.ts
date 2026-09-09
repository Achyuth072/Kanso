import { describe, it, expect } from "vitest";
import {
  dedupeIcsEvents,
  isIcsUidConflict,
} from "@/lib/import/dedupeIcsEvents";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

function event(
  overrides: Partial<CreateCalendarEventInput> = {},
): CreateCalendarEventInput {
  return {
    title: "Standup",
    start_time: "2026-06-12T09:00:00.000Z",
    end_time: "2026-06-12T09:30:00.000Z",
    ...overrides,
  };
}

describe("dedupeIcsEvents", () => {
  it("keeps every event when nothing collides", () => {
    const parsed = [
      event({ ics_uid: "a" }),
      event({ ics_uid: "b", start_time: "2026-06-13T09:00:00.000Z" }),
    ];

    const result = dedupeIcsEvents(parsed, new Set());

    expect(result.toCreate).toHaveLength(2);
    expect(result.skipped).toBe(0);
  });

  it("drops events whose uid is already in the account", () => {
    const parsed = [event({ ics_uid: "a" }), event({ ics_uid: "b" })];

    const result = dedupeIcsEvents(parsed, new Set(["a"]));

    expect(result.toCreate.map((e) => e.ics_uid)).toEqual(["b"]);
    expect(result.skipped).toBe(1);
  });

  it("collapses repeats inside a single file", () => {
    const parsed = [
      event({ ics_uid: "a" }),
      event({ ics_uid: "a" }),
      event({ ics_uid: "a" }),
    ];

    const result = dedupeIcsEvents(parsed, new Set());

    expect(result.toCreate).toHaveLength(1);
    expect(result.skipped).toBe(2);
  });

  it("re-importing the same file a second time adds nothing", () => {
    const parsed = [event({ ics_uid: "a" }), event({ ics_uid: "b" })];

    const first = dedupeIcsEvents(parsed, new Set());
    const existing = new Set(first.toCreate.map((e) => e.ics_uid as string));
    const second = dedupeIcsEvents(parsed, existing);

    expect(second.toCreate).toHaveLength(0);
    expect(second.skipped).toBe(2);
  });

  it("falls back to start/end/title when a VEVENT carries no uid", () => {
    const parsed = [
      event({ ics_uid: null }),
      event({ ics_uid: null }),
      event({ ics_uid: null, title: "Different" }),
    ];

    const result = dedupeIcsEvents(parsed, new Set());

    expect(result.toCreate).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });

  it("treats a uid-less event as distinct from a uid-bearing one at the same time", () => {
    const parsed = [event({ ics_uid: null })];

    const result = dedupeIcsEvents(parsed, new Set(["a"]));

    expect(result.toCreate).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });
});

describe("isIcsUidConflict", () => {
  it("recognizes a Postgres unique_violation", () => {
    expect(isIcsUidConflict({ code: "23505" })).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isIcsUidConflict({ code: "23503" })).toBe(false);
    expect(isIcsUidConflict(new Error("boom"))).toBe(false);
    expect(isIcsUidConflict(null)).toBe(false);
  });
});
