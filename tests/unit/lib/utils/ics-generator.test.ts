import { describe, it, expect } from "vitest";
import { generateICS } from "@/lib/utils/ics-generator";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

describe("ICS Generator", () => {
  const mockEvents: CalendarEventUI[] = [
    {
      id: "1",
      title: "Test Event",
      start: new Date("2024-01-01T10:00:00Z"),
      end: new Date("2024-01-01T11:00:00Z"),
      allDay: false,
      color: "#ff0000",
      description: "Test Description",
      location: "Test Location",
      category: "Work",
    },
    {
      id: "2",
      title: "All Day Event",
      start: new Date("2024-01-02T00:00:00Z"),
      end: new Date("2024-01-03T00:00:00Z"),
      allDay: true,
      color: "#00ff00",
    },
  ];

  it("generates valid ICS content for multiple events", () => {
    const ics = generateICS(mockEvents);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("PRODID:-//Kanso//Calendar//EN");
    expect(ics).toContain("SUMMARY:Test Event");
    expect(ics).toContain("DESCRIPTION:Test Description");
    expect(ics).toContain("LOCATION:Test Location");
    expect(ics).toContain("CATEGORIES:Work");
    expect(ics).toContain("SUMMARY:All Day Event");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("correctly formats all-day events", () => {
    const ics = generateICS([mockEvents[1]]);

    // All-day events in ICS should have DTSTART;VALUE=DATE
    expect(ics).toContain("DTSTART;VALUE=DATE:20240102");
    // Note: Some generators use DTEND as the day after, some use the same day.
    // ical-generator follows RFC 5545 where DTEND is non-inclusive end time.
    expect(ics).toContain("DTEND;VALUE=DATE:20240103");
  });

  it("skips archived events", () => {
    const archivedEvent: CalendarEventUI = {
      ...mockEvents[0],
      isArchived: true,
    };
    const ics = generateICS([archivedEvent]);

    expect(ics).not.toContain("SUMMARY:Test Event");
  });
});
