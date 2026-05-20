/**
 * Sync Orchestrator Service
 * Handles the high-level sync flow for any provider using the SyncAdapter interface.
 */

import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { UpdateExternalCalendarInput } from "@/lib/types/external-calendar";
import {
  getAdapter,
  type SyncResult,
  type SyncAdapterConfig,
  type RemoteEvent,
} from "./adapter-interface";

/**
 * Perform a full sync for an external calendar
 */
export async function syncExternalCalendar(
  calendarId: string,
  config: Partial<SyncAdapterConfig> = {},
): Promise<SyncResult> {
  const supabase = createClient();
  const result: SyncResult = {
    created: 0,
    updated: 0,
    archived: 0,
    pushed: 0,
    errors: [],
    newSyncToken: null,
  };

  try {
    // 1. Fetch calendar metadata from DB
    const { data: calendar, error: calError } = await supabase
      .from("external_calendars")
      .select("*")
      .eq("id", calendarId)
      .single();

    if (calError || !calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    const adapter = getAdapter(calendar.provider);

    // 2. Initialize adapter
    await adapter.initialize({
      externalCalendar: calendar,
      ...config,
    });

    // 3. Mark as syncing in DB
    await updateCalendarStatus(calendarId, { sync_status: "syncing" });

    // 4. Determine sync type (incremental vs full)
    let remoteEvents: RemoteEvent[] = [];
    let deletedRemoteIds: string[] = [];
    let newSyncToken = "";

    if (calendar.sync_token) {
      try {
        const delta = await adapter.incrementalSync(calendar.sync_token);
        remoteEvents = delta.updated;
        deletedRemoteIds = delta.deleted;
        newSyncToken = delta.newSyncToken;
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "SYNC_TOKEN_EXPIRED") {
          // Fallback to full sync
          const full = await adapter.fullSync();
          remoteEvents = full.events;
          newSyncToken = full.syncToken;
        } else {
          throw e;
        }
      }
    } else {
      const full = await adapter.fullSync();
      remoteEvents = full.events;
      newSyncToken = full.syncToken;
    }

    // 5. Fetch local events for this calendar
    const { data: localEvents, error: localError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("remote_calendar_id", calendarId);

    if (localError) throw localError;

    // 6. Execute sync logic (Apply Remote Changes)
    const localByRemoteId = new Map<string, CalendarEvent>(
      (localEvents as CalendarEvent[])
        ?.filter((e) => e.metadata?.remote_id)
        .map((e) => [e.metadata!.remote_id as string, e]) || [],
    );

    // 6a. Process remote additions/updates
    for (const remote of remoteEvents) {
      const existing = localByRemoteId.get(remote.remoteId);
      const parsed = adapter.parseRemoteEvent(remote);
      if (!parsed) continue;

      if (!existing) {
        // Create locally
        const { error } = await supabase.from("calendar_events").insert({
          ...parsed,
          user_id: calendar.user_id,
          remote_calendar_id: calendar.id,
          metadata: {
            ...parsed.metadata,
            remote_id: remote.remoteId,
            etag: remote.etag,
          },
        });
        if (error)
          result.errors.push(
            `Failed to create ${remote.remoteId}: ${error.message}`,
          );
        else result.created++;
      } else {
        // Update locally (LWW — simplified: assume remote is always source of truth for now)
        if (existing.metadata?.etag !== remote.etag) {
          const { error } = await supabase
            .from("calendar_events")
            .update({
              ...parsed,
              metadata: {
                ...parsed.metadata,
                remote_id: remote.remoteId,
                etag: remote.etag,
              },
            })
            .eq("id", existing.id);
          if (error)
            result.errors.push(
              `Failed to update ${existing.id}: ${error.message}`,
            );
          else result.updated++;
        }
      }
    }

    // 6b. Process remote deletions
    for (const remoteId of deletedRemoteIds) {
      const existing = localByRemoteId.get(remoteId);
      if (existing) {
        const { error } = await supabase
          .from("calendar_events")
          .update({ is_archived: true })
          .eq("id", existing.id);
        if (error)
          result.errors.push(
            `Failed to archive ${existing.id}: ${error.message}`,
          );
        else result.archived++;
      }
    }

    // 7. Execute bidirectional sync (Push Local Changes)
    if (calendar.sync_direction === "bidirectional") {
      const { data: pendingPush } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("remote_calendar_id", calendar.id)
        .is("metadata->remote_id", null);

      if (pendingPush) {
        for (const local of pendingPush) {
          try {
            const { remoteId, etag } = await adapter.pushEvent(local);
            await supabase
              .from("calendar_events")
              .update({
                metadata: {
                  ...((local.metadata as Record<string, unknown>) || {}),
                  remote_id: remoteId,
                  etag,
                },
              })
              .eq("id", local.id);
            result.pushed++;
          } catch (e: unknown) {
            result.errors.push(
              `Failed to push local ${local.id}: ${
                e instanceof Error ? e.message : String(e)
              }`,
            );
          }
        }
      }
    }

    // 8. Finalize status and sync token
    result.newSyncToken = newSyncToken;
    await updateCalendarStatus(calendarId, {
      sync_status: result.errors.length > 0 ? "error" : "success",
      sync_error: result.errors.length > 0 ? result.errors[0] : undefined,
      sync_token: newSyncToken,
      last_sync_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    result.errors.push(message);
    await updateCalendarStatus(calendarId, {
      sync_status: "error",
      sync_error: message,
    });
  }

  return result;
}

async function updateCalendarStatus(
  id: string,
  updates: Partial<UpdateExternalCalendarInput>,
) {
  const supabase = createClient();
  await supabase.from("external_calendars").update(updates).eq("id", id);
}
