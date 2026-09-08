export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  color: string;
  category: string | null;
  recurrence_rule: string | null;
  remote_id: string | null;
  remote_calendar_id: string | null;
  etag: string | null;
  ics_uid: string | null;
  sync_state: "pending_create" | "pending_update" | "pending_delete" | null;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  color?: string;
  category?: string;
  recurrence_rule?: string;
  ics_uid?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCalendarEventInput {
  id: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  color?: string;
  category?: string | null;
  recurrence_rule?: string | null;
  is_archived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CalendarEventUI {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

export function toCalendarEventUI(event: CalendarEvent): CalendarEventUI {
  return {
    id: event.id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    allDay: event.all_day,
    color: event.color,
    description: event.description,
    location: event.location,
    category: event.category,
    isArchived: event.is_archived,
    metadata: event.metadata,
  };
}
