import { createClient } from "@/lib/supabase/client";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/lib/types/calendar-event";
import { applyCrudTransition } from "@/lib/sync/crud-state";

export const calendarEventMutations = {
  create: async (
    input: CreateCalendarEventInput & { _clientId?: string },
  ): Promise<CalendarEvent> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const event: CalendarEvent = {
        id: input._clientId || crypto.randomUUID(),
        user_id: "guest",
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day || false,
        color: input.color || "#4B6CB7",
        category: input.category || null,
        recurrence_rule: input.recurrence_rule || null,
        remote_id: null,
        remote_calendar_id: null,
        etag: null,
        ics_uid: input.ics_uid || null,
        sync_state: null,
        is_archived: false,
        metadata: input.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return event;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const eventId = input._clientId || crypto.randomUUID();

    // Default-new-event target (55-DESIGN): a brand-new Kagelin event has no home,
    // so it round-trips through the first-connected bidirectional calendar.
    // Recurring authored events stay local-only — never half-sync a series.
    let remoteCalendarId: string | null = null;
    let syncState: "pending_create" | null = null;
    if (!input.recurrence_rule) {
      const { data: bidi } = await supabase
        .from("external_calendars")
        .select("id")
        .eq("user_id", user.id)
        .eq("sync_direction", "bidirectional")
        .eq("sync_enabled", true)
        .order("created_at", { ascending: true })
        .limit(1);
      if (bidi?.[0]) {
        remoteCalendarId = bidi[0].id;
        syncState = "pending_create";
      }
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        id: eventId,
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day || false,
        color: input.color || "#4B6CB7",
        category: input.category || null,
        recurrence_rule: input.recurrence_rule || null,
        ics_uid: input.ics_uid || null,
        remote_calendar_id: remoteCalendarId,
        sync_state: syncState,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as CalendarEvent;
  },

  update: async (input: UpdateCalendarEventInput): Promise<CalendarEvent> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { id, ...updates } = input;

    if (isGuest) {
      throw new Error("Guest mode calendar event updates not yet implemented");
    }

    const supabase = createClient();

    const { data: current } = await supabase
      .from("calendar_events")
      .select("sync_state, remote_calendar_id")
      .eq("id", id)
      .single();

    const syncUpdate = current?.remote_calendar_id
      ? { sync_state: applyCrudTransition(current.sync_state, "edit").newState }
      : {};

    const { data, error } = await supabase
      .from("calendar_events")
      .update({ ...updates, ...syncUpdate })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as CalendarEvent;
  },

  delete: async (id: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      return;
    }

    const supabase = createClient();

    const { data: current } = await supabase
      .from("calendar_events")
      .select("sync_state, remote_calendar_id")
      .eq("id", id)
      .single();

    if (current?.remote_calendar_id) {
      const { newState, hardDelete } = applyCrudTransition(
        current.sync_state,
        "delete",
      );
      if (hardDelete) {
        const { error } = await supabase
          .from("calendar_events")
          .delete()
          .eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("calendar_events")
          .update({ sync_state: newState })
          .eq("id", id);
        if (error) throw new Error(error.message);
      }
      return;
    }

    // Pure local event — soft delete per D-48-06
    const { error } = await supabase
      .from("calendar_events")
      .update({ is_archived: true })
      .eq("id", id);

    if (error) throw new Error(error.message);
  },
};
