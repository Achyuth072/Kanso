import { expect, test, describe } from "vitest";
import { parseICS } from "@/lib/utils/ics-parser";

describe("ics-parser", () => {
  test("parses a single event successfully", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kanso//Test//EN
BEGIN:VEVENT
UID:123@kanso
DTSTAMP:20260326T100000Z
DTSTART:20260327T090000Z
DTEND:20260327T100000Z
SUMMARY:Meeting with Dev
DESCRIPTION:Discuss ICS implementation
LOCATION:London
END:VEVENT
END:VCALENDAR`;
    const { events, errors } = parseICS(ics);
    expect(errors).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Meeting with Dev");
    expect(events[0].description).toBe("Discuss ICS implementation");
    expect(events[0].location).toBe("London");
    expect(new Date(events[0].start_time).getUTCFullYear()).toBe(2026);
    expect(events[0].all_day).toBe(false);
    expect(events[0].metadata?.ics_uid).toBe("123@kanso");
  });

  test("detects all-day events", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day@kanso
DTSTART;VALUE=DATE:20260328
SUMMARY:Holiday
END:VEVENT
END:VCALENDAR`;
    const { events, errors } = parseICS(ics);
    expect(errors).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].all_day).toBe(true);
    expect(events[0].title).toBe("Holiday");
  });

  test("handles multiple events", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event1
DTSTART:20260329T090000Z
SUMMARY:Event 1
END:VEVENT
BEGIN:VEVENT
UID:event2
DTSTART:20260329T110000Z
SUMMARY:Event 2
END:VEVENT
END:VCALENDAR`;
    const { events, errors } = parseICS(ics);
    expect(errors).toHaveLength(0);
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Event 1");
    expect(events[1].title).toBe("Event 2");
  });

  test("returns no events for invalid content", () => {
    const ics = "This is not an ICS file";
    const { events } = parseICS(ics);
    expect(events).toHaveLength(0);
    // Note: node-ical doesn't always throw for random text, it just returns an empty object.
  });
});
