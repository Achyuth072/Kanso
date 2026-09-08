import "./register-adapters";
import { createClient } from "@/lib/supabase/client";
import { describeError } from "@/lib/errors/describeError";
import { isContentKeyUnavailableError } from "@/lib/supabase/wrapClient";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  UpdateExternalCalendarInput,
} from "@/lib/types/external-calendar";
import {
  getAdapter,
  type SyncResult,
  type SyncAdapter,
  type SyncAdapterConfig,
  type RemoteEvent,
} from "./adapter-interface";
import { computePullMutations, type PullMutations } from "./pull-merge";

function describeSyncError(e: unknown): string {
  if (isContentKeyUnavailableError(e)) {
    return "Content is locked — unlock the app to sync";
  }
  return describeError(e);
}

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
    const { data: calendar, error: calError } = await supabase
      .from("external_calendars")
      .select("*")
      .eq("id", calendarId)
      .single();

    if (calError || !calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    const adapter = getAdapter(calendar.provider);

    await adapter.initialize({
      externalCalendar: calendar,
      ...config,
    });

    await updateCalendarStatus(calendarId, { sync_status: "syncing" });

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

    // Fetch all rows: computePullMutations keys by remote_id, so omitted rows would duplicate.
    const localEvents = await fetchAllRows<CalendarEvent>((from, to) =>
      supabase
        .from("calendar_events")
        .select("*")
        .eq("remote_calendar_id", calendarId)
        .order("id", { ascending: true })
        .range(from, to),
    );

    const incoming = remoteEvents
      .map((remote) => {
        const parsed = adapter.parseRemoteEvent(remote);
        if (!parsed) return null;
        return {
          remoteId: remote.remoteId,
          etag: remote.etag,
          updatedAt: remote.updatedAt ?? new Date(),
          kansoId: remote.kansoId,
          parsed,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    const mutations = computePullMutations(
      localEvents,
      incoming,
      deletedRemoteIds,
    );

    const pullResult = await applyPullMutations(mutations, calendar);
    result.created += pullResult.created;
    result.updated += pullResult.updated;
    result.archived += pullResult.archived;
    result.errors.push(...pullResult.errors);

    if (calendar.sync_direction === "bidirectional") {
      const pushResult = await pushPendingEvents(calendar, adapter);
      result.pushed += pushResult.pushed;
      result.errors.push(...pushResult.errors);
    }

    result.newSyncToken = newSyncToken;
    await updateCalendarStatus(calendarId, {
      sync_status: result.errors.length > 0 ? "error" : "success",
      sync_error: result.errors.length > 0 ? result.errors[0] : undefined,
      sync_token: newSyncToken,
      last_sync_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const descriptor = describeSyncError(e);
    result.errors.push(descriptor);
    await updateCalendarStatus(calendarId, {
      sync_status: "error",
      sync_error: descriptor,
    });
  }

  return result;
}

export async function pushPendingEvents(
  calendar: Pick<
    ExternalCalendar,
    "id" | "user_id" | "sync_direction" | "provider"
  >,
  adapter: Pick<
    SyncAdapter,
    "pushEvent" | "updateRemoteEvent" | "deleteRemoteEvent"
  >,
): Promise<Pick<SyncResult, "pushed" | "errors">> {
  const supabase = createClient();
  const result = { pushed: 0, errors: [] as string[] };

  const pending = await fetchAllRows<CalendarEvent>((from, to) =>
    supabase
      .from("calendar_events")
      .select("*")
      .eq("remote_calendar_id", calendar.id)
      .not("sync_state", "is", null)
      .order("id", { ascending: true })
      .range(from, to),
  );

  for (const event of pending) {
    try {
      if (event.sync_state === "pending_delete") {
        await adapter.deleteRemoteEvent(event.remote_id!);
        await supabase.from("calendar_events").delete().eq("id", event.id);
        result.pushed++;
        continue;
      }

      let remoteId = event.remote_id;
      let etag: string;

      if (event.sync_state === "pending_create") {
        const pushed = await adapter.pushEvent(event);
        remoteId = pushed.remoteId;
        etag = pushed.etag;
      } else {
        const updated = await adapter.updateRemoteEvent(
          event.remote_id!,
          event,
        );
        etag = updated.etag;
      }

      const { count } = await supabase
        .from("calendar_events")
        .update(
          { remote_id: remoteId, etag, sync_state: null },
          { count: "exact" },
        )
        .eq("id", event.id)
        .eq("updated_at", event.updated_at);

      if (count === 0) {
        // Concurrent edit advanced updated_at; keep pending_update to re-push.
        await supabase
          .from("calendar_events")
          .update({ remote_id: remoteId, etag, sync_state: "pending_update" })
          .eq("id", event.id);
      }

      result.pushed++;
    } catch (e: unknown) {
      result.errors.push(`Failed to push ${event.id}: ${describeSyncError(e)}`);
    }
  }

  return result;
}

export async function applyPullMutations(
  mutations: PullMutations,
  calendar: Pick<ExternalCalendar, "id" | "user_id">,
): Promise<Pick<SyncResult, "created" | "updated" | "archived" | "errors">> {
  const supabase = createClient();
  const result = {
    created: 0,
    updated: 0,
    archived: 0,
    errors: [] as string[],
  };

  // Dedup across user's calendars: skip existing events, but revive archived orphans from disconnects.
  if (mutations.toCreate.length > 0) {
    const remoteIds = mutations.toCreate
      .map((item) => item.remote_id)
      .filter((id): id is string => !!id);

    let existingByRemoteId = new Map<
      string,
      { id: string; is_archived: boolean }
    >();
    if (remoteIds.length > 0) {
      const existing = await fetchAllRows<{
        id: string;
        remote_id: string;
        is_archived: boolean;
      }>((from, to) =>
        supabase
          .from("calendar_events")
          .select("id, remote_id, is_archived")
          .eq("user_id", calendar.user_id)
          .in("remote_id", remoteIds)
          .order("id", { ascending: true })
          .range(from, to),
      );
      existingByRemoteId = new Map(
        existing.map((e) => [
          e.remote_id,
          { id: e.id, is_archived: e.is_archived },
        ]),
      );
    }

    const rows: Array<Record<string, unknown>> = [];
    const revivals: Array<{
      id: string;
      item: (typeof mutations.toCreate)[number];
    }> = [];
    for (const item of mutations.toCreate) {
      const match = item.remote_id
        ? existingByRemoteId.get(item.remote_id)
        : undefined;
      if (!match) {
        rows.push({
          ...item,
          user_id: calendar.user_id,
          remote_calendar_id: calendar.id,
        });
      } else if (match.is_archived) {
        revivals.push({ id: match.id, item });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("calendar_events").insert(rows);
      if (error) {
        result.errors.push(
          `Failed to batch-create events: ${describeSyncError(error)}`,
        );
      } else {
        result.created += rows.length;
      }
    }

    await Promise.all(
      revivals.map(async ({ id, item }) => {
        const { error } = await supabase
          .from("calendar_events")
          .update({
            ...item,
            remote_calendar_id: calendar.id,
            is_archived: false,
          })
          .eq("id", id);
        if (error)
          result.errors.push(
            `Failed to revive ${id}: ${describeSyncError(error)}`,
          );
        else result.created++;
      }),
    );
  }

  await Promise.all(
    mutations.toUpdate.map(async (item) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          ...item.data,
          etag: item.etag,
          ...(item.clearSyncState ? { sync_state: null } : {}),
        })
        .eq("id", item.id);
      if (error)
        result.errors.push(
          `Failed to update ${item.id}: ${describeSyncError(error)}`,
        );
      else result.updated++;
    }),
  );

  if (mutations.toArchive.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .update({ is_archived: true })
      .in("id", mutations.toArchive);
    if (error)
      result.errors.push(
        `Failed to batch-archive events: ${describeSyncError(error)}`,
      );
    else result.archived += mutations.toArchive.length;
  }

  if (mutations.toHardDelete.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .in("id", mutations.toHardDelete);
    if (error)
      result.errors.push(
        `Failed to batch-delete events: ${describeSyncError(error)}`,
      );
  }

  await Promise.all(
    mutations.toAdopt.map(async (item) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({
          remote_id: item.remote_id,
          etag: item.etag,
          sync_state: null,
        })
        .eq("id", item.id);
      if (error)
        result.errors.push(
          `Failed to adopt ${item.id}: ${describeSyncError(error)}`,
        );
    }),
  );

  return result;
}

async function updateCalendarStatus(
  id: string,
  updates: Partial<UpdateExternalCalendarInput>,
) {
  const supabase = createClient();
  await supabase.from("external_calendars").update(updates).eq("id", id);
}
