import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type { ExternalCalendar } from "@/lib/types/external-calendar";
import { parseICS } from "@/lib/utils/ics-parser";

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
  newSyncToken: string | null;
}

/**
 * Determine sync action based on timestamps (LWW per D-48-04)
 */
export function determineAction(
  localEvent: CalendarEvent | null,
  remoteUpdatedAt: Date,
  localUpdatedAt?: Date,
): "create" | "update_local" | "update_remote" | "skip" {
  if (!localEvent) {
    return "create";
  }

  const local = localUpdatedAt || new Date(localEvent.updated_at);

  // LWW: Most recent timestamp wins
  if (remoteUpdatedAt > local) {
    return "update_local";
  } else if (local > remoteUpdatedAt) {
    return "update_remote";
  }

  return "skip"; // Same timestamp, no action needed
}

/**
 * Process a single event from CalDAV server
 * Returns the event data to create/update in local DB
 */
export function processRemoteEvent(
  icsData: string,
  remoteUrl: string,
  etag: string,
  externalCalendar: ExternalCalendar,
): CreateCalendarEventInput | null {
  const { events, errors } = parseICS(icsData);

  if (errors.length > 0) {
    console.warn(`Parse errors for ${remoteUrl}:`, errors);
  }

  if (events.length === 0) {
    return null;
  }

  const event = events[0];

  return {
    ...event,
    color: externalCalendar.color,
    metadata: {
      ...event.metadata,
      remote_url: remoteUrl,
      remote_calendar_id: externalCalendar.id,
      etag,
      synced_at: new Date().toISOString(),
    },
  };
}

/**
 * Mark local events as archived when deleted remotely (D-48-06)
 */
export function getDeletedEventUpdates(
  deletedRemoteUrls: string[],
  localEvents: CalendarEvent[],
): string[] {
  // Find local events whose remote URLs are in the deleted list
  return localEvents
    .filter((e) => {
      const remoteUrl = (e.metadata as Record<string, unknown>)?.remote_url as
        | string
        | undefined;
      return remoteUrl && deletedRemoteUrls.includes(remoteUrl);
    })
    .map((e) => e.id);
}

/**
 * Compare local and remote events to determine what needs syncing
 */
export interface SyncPlan {
  toCreateLocally: CreateCalendarEventInput[];
  toUpdateLocally: Array<{ id: string; updates: Partial<CalendarEvent> }>;
  toArchiveLocally: string[];
  toPushToRemote: CalendarEvent[];
  toDeleteFromRemote: string[];
}

export function createSyncPlan(
  localEvents: CalendarEvent[],
  remoteEvents: Array<{ url: string; etag: string; data: string }>,
  deletedRemoteUrls: string[],
  externalCalendar: ExternalCalendar,
): SyncPlan {
  const plan: SyncPlan = {
    toCreateLocally: [],
    toUpdateLocally: [],
    toArchiveLocally: [],
    toPushToRemote: [],
    toDeleteFromRemote: [],
  };

  // Build lookup maps
  const localByRemoteUrl = new Map<string, CalendarEvent>();
  const localByIcsUid = new Map<string, CalendarEvent>();

  for (const event of localEvents) {
    const remoteUrl = (event.metadata as Record<string, unknown>)
      ?.remote_url as string | undefined;
    if (remoteUrl) {
      localByRemoteUrl.set(remoteUrl, event);
    }
    if (event.ics_uid) {
      localByIcsUid.set(event.ics_uid, event);
    }
  }

  // Process remote events
  for (const remote of remoteEvents) {
    const parsed = processRemoteEvent(
      remote.data,
      remote.url,
      remote.etag,
      externalCalendar,
    );
    if (!parsed) continue;

    const existingByUrl = localByRemoteUrl.get(remote.url);
    const icsUid = (parsed.metadata as Record<string, unknown>)?.ics_uid as
      | string
      | undefined;
    const existingByUid = icsUid ? localByIcsUid.get(icsUid) : undefined;
    const existing = existingByUrl || existingByUid;

    if (!existing) {
      plan.toCreateLocally.push(parsed);
    } else {
      // Check if remote is newer (simplified - actual impl would parse LAST-MODIFIED from ICS)
      const existingEtag = (existing.metadata as Record<string, unknown>)
        ?.etag as string | undefined;
      if (existingEtag !== remote.etag) {
        plan.toUpdateLocally.push({
          id: existing.id,
          updates: {
            title: parsed.title,
            description: parsed.description || null,
            location: parsed.location || null,
            start_time: parsed.start_time,
            end_time: parsed.end_time,
            all_day: parsed.all_day,
            metadata: parsed.metadata,
          },
        });
      }
    }
  }

  // Handle deleted remote events
  plan.toArchiveLocally = getDeletedEventUpdates(
    deletedRemoteUrls,
    localEvents,
  );

  // Find local events that need pushing to remote (bidirectional only)
  if (externalCalendar.sync_direction === "bidirectional") {
    for (const local of localEvents) {
      const remoteUrl = (local.metadata as Record<string, unknown>)
        ?.remote_url as string | undefined;
      if (!remoteUrl && local.remote_calendar_id === externalCalendar.id) {
        // Local event for this calendar but not yet synced to remote
        plan.toPushToRemote.push(local);
      }
    }
  }

  return plan;
}
