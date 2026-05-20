import ICAL from "ical.js";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

export interface ParsedICSResult {
  events: CreateCalendarEventInput[];
  errors: string[];
}

/**
 * Parse ICS content into CreateCalendarEventInput objects using ical.js (browser-compatible)
 * Handles RFC 5545 compliant .ics files
 */
export function parseICS(icsContent: string): ParsedICSResult {
  const events: CreateCalendarEventInput[] = [];
  const errors: string[] = [];

  try {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    vevents.forEach((veventComp, index) => {
      try {
        const event = new ICAL.Event(veventComp);

        const start = event.startDate;
        if (!start) {
          errors.push(`Event at index ${index} has no start date, skipping.`);
          return;
        }

        // ical.js endDate might be missing, default to 1h after start
        let end = event.endDate;
        if (!end) {
          const duration = new ICAL.Duration({ hours: 1 });
          end = start.clone();
          end.addDuration(duration);
        }

        const input: CreateCalendarEventInput = {
          title: event.summary || "Untitled Event",
          description: event.description || undefined,
          location: event.location || undefined,
          start_time: start.toJSDate().toISOString(),
          end_time: end.toJSDate().toISOString(),
          all_day: start.isDate,
          metadata: {
            ics_uid: event.uid,
            imported_at: new Date().toISOString(),
          },
        };

        events.push(input);
      } catch (err) {
        errors.push(
          `Failed to parse event at index ${index}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    });
  } catch (err) {
    errors.push(
      `Failed to parse ICS content: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  return { events, errors };
}

/**
 * Parse ICS file from File object (for browser file input)
 */
export async function parseICSFile(file: File): Promise<ParsedICSResult> {
  const content = await file.text();
  return parseICS(content);
}
