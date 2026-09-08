import { describe, it, expect } from "vitest";
import { parseICS } from "@/lib/utils/ics-parser";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-uid-1@example.com
SUMMARY:Weekly standup
DTSTART:20260612T090000Z
DTEND:20260612T093000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:No uid here
DTSTART:20260613T090000Z
DTEND:20260613T093000Z
END:VEVENT
END:VCALENDAR`;

describe("parseICS uid handling", () => {
  it("puts the VEVENT uid in the queryable ics_uid column, not encrypted metadata", () => {
    const { events } = parseICS(ICS);

    expect(events[0].ics_uid).toBe("event-uid-1@example.com");
    // metadata is encrypted at rest, so a dedup key stored there is unreadable.
    expect(events[0].metadata).not.toHaveProperty("ics_uid");
  });

  it("leaves ics_uid null when the VEVENT carries no uid", () => {
    const { events } = parseICS(ICS);

    expect(events[1].ics_uid).toBeNull();
  });

  it("still records when the import happened", () => {
    const { events } = parseICS(ICS);

    expect(events[0].metadata).toHaveProperty("imported_at");
  });
});
