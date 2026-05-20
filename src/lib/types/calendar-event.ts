/**
 * Calendar Event Types
 * Matches supabase calendar_events table schema
 */

export interface CalendarEvent {
  id: string;
  user_id: string;

  // Core Event Fields
  title: string;
  description: string | null;
  location: string | null;
  start_time: string; // ISO string from DB
  end_time: string; // ISO string from DB
  all_day: boolean;

  // Categorization
  color: string;
  category: string | null;

  // Recurrence
  recurrence_rule: string | null;

  // Sync Metadata
  remote_id: string | null;
  remote_calendar_id: string | null;
  etag: string | null;
  ics_uid: string | null;

  // Soft Deletion
  is_archived: boolean;

  // Flexible Metadata
  metadata: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  all_day?: boolean;
  color?: string;
  category?: string;
  recurrence_rule?: string;
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

/**
 * UI-ready event type with Date objects (for calendar rendering)
 * Used by calendar engine and components
 */
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
}

/**
 * Transform DB event to UI event
 */
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
  };
}
