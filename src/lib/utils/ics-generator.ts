import ical, { ICalCalendar, ICalEventData } from "ical-generator";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

/**
 * Generate RFC 5545 compliant ICS content from CalendarEventUI array
 */
export function generateICS(
  events: CalendarEventUI[],
  calendarName: string = "Kanso Calendar",
): string {
  const calendar: ICalCalendar = ical({
    name: calendarName,
  });

  // Set Product ID
  calendar.prodId({
    company: "Kanso",
    product: "Calendar",
    language: "EN",
  });

  for (const event of events) {
    // Skip archived events
    if (event.isArchived) continue;

    const eventData: ICalEventData = {
      id: event.id,
      start: event.start,
      end: event.end,
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      allDay: event.allDay,
    };

    // Add category if present
    if (event.category) {
      eventData.categories = [{ name: event.category }];
    }

    calendar.createEvent(eventData);
  }

  return calendar.toString();
}

/**
 * Generate ICS and trigger download in browser
 */
export function downloadICS(
  events: CalendarEventUI[],
  filename: string = "kanso-calendar.ics",
): void {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
