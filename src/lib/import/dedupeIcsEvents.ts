import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

export interface IcsDedupeResult {
  toCreate: CreateCalendarEventInput[];
  skipped: number;
}

// A VEVENT without a UID is out of spec but common in hand-rolled exports.
function identityOf(event: CreateCalendarEventInput): string {
  return event.ics_uid
    ? `uid:${event.ics_uid}`
    : `time:${event.start_time}|${event.end_time}|${event.title}`;
}

export function dedupeIcsEvents(
  parsed: CreateCalendarEventInput[],
  existingUids: ReadonlySet<string>,
): IcsDedupeResult {
  const seen = new Set<string>();
  const toCreate: CreateCalendarEventInput[] = [];

  for (const event of parsed) {
    const identity = identityOf(event);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (event.ics_uid && existingUids.has(event.ics_uid)) continue;
    toCreate.push(event);
  }

  return { toCreate, skipped: parsed.length - toCreate.length };
}
