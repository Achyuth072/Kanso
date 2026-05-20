import { createClient } from "@/lib/supabase/client";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/lib/types/calendar-event";

export const calendarEventMutations = {
  create: async (
    input: CreateCalendarEventInput & { _clientId?: string },
  ): Promise<CalendarEvent> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      // Guest mode: store in mockStore stub
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
        ics_uid: null,
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
    const { data, error } = await supabase
      .from("calendar_events")
      .update(updates)
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
    // Soft delete per D-48-06
    const { error } = await supabase
      .from("calendar_events")
      .update({ is_archived: true })
      .eq("id", id);

    if (error) throw new Error(error.message);
  },
};
