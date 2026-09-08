import ICAL from "ical.js";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

export interface ParsedICSResult {
  events: CreateCalendarEventInput[];
  errors: string[];
}

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
          // Dedup key must stay queryable, so it goes in the ics_uid column —
          // metadata is encrypted at rest and unreadable server-side.
          ics_uid: event.uid || null,
          metadata: {
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

export async function parseICSFile(file: File): Promise<ParsedICSResult> {
  const content = await file.text();
  return parseICS(content);
}
