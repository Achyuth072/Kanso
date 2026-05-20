/**
 * Google Calendar Sync Adapter (Premium Tier)
 * Implements SyncAdapter for Google Calendar API
 *
 * Per D-48-08: Built now, but feature-flagged as Premium
 * Uses Supabase OAuth tokens for authentication
 */

import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  DiscoveredCalendar,
  CalendarProvider,
  GoogleCalendarListItem,
} from "@/lib/types/external-calendar";
import type {
  SyncAdapter,
  SyncAdapterConfig,
  SyncDelta,
  RemoteEvent,
} from "./adapter-interface";
import { registerAdapter } from "./adapter-interface";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarAdapter implements SyncAdapter {
  readonly provider: CalendarProvider = "google";

  private accessToken: string | null = null;
  private externalCalendar: ExternalCalendar | null = null;

  async initialize(config: SyncAdapterConfig): Promise<void> {
    if (!config.accessToken) {
      throw new Error("Google adapter requires OAuth accessToken in config");
    }

    this.accessToken = config.accessToken;
    this.externalCalendar = config.externalCalendar;

    // Validate token by making a simple API call
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=1`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Google API auth failed: ${response.status}`);
    }
  }

  async discoverCalendars(): Promise<DiscoveredCalendar[]> {
    if (!this.accessToken) {
      throw new Error("Adapter not initialized");
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/users/me/calendarList`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.status}`);
    }

    const data = await response.json();
    const items: GoogleCalendarListItem[] = data.items || [];

    return items.map((cal) => ({
      url: cal.id, // Google uses calendar ID as URL
      displayName: cal.summary,
      description: cal.description,
      color: cal.backgroundColor,
    }));
  }

  async fullSync(timeWindowDays: number = 730): Promise<{
    events: RemoteEvent[];
    syncToken: string;
  }> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = encodeURIComponent(
      this.externalCalendar.remote_calendar_id,
    );
    const timeMin = new Date(
      Date.now() - timeWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const timeMax = new Date(
      Date.now() + timeWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const url = `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data = await response.json();

    return {
      events: (data.items || []).map((item: Record<string, unknown>) => ({
        remoteId: item.id as string,
        etag: item.etag as string,
        data: item, // Store full Google event object
        updatedAt: item.updated ? new Date(item.updated as string) : undefined,
      })),
      syncToken: data.nextSyncToken || "",
    };
  }

  async incrementalSync(syncToken: string): Promise<SyncDelta> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = encodeURIComponent(
      this.externalCalendar.remote_calendar_id,
    );
    const url = `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events?syncToken=${syncToken}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      // Sync token may be invalidated — need full sync
      if (response.status === 410) {
        throw new Error("SYNC_TOKEN_EXPIRED");
      }
      throw new Error(`Incremental sync failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    const deleted: string[] = [];
    const updated: RemoteEvent[] = [];

    for (const item of items) {
      if (item.status === "cancelled") {
        deleted.push(item.id);
      } else {
        updated.push({
          remoteId: item.id as string,
          etag: item.etag as string,
          data: item,
          updatedAt: item.updated
            ? new Date(item.updated as string)
            : undefined,
        });
      }
    }

    return {
      created: [], // Caller determines this
      updated,
      deleted,
      newSyncToken: data.nextSyncToken || syncToken,
    };
  }

  async pushEvent(
    event: CalendarEvent,
  ): Promise<{ remoteId: string; etag: string }> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = encodeURIComponent(
      this.externalCalendar.remote_calendar_id,
    );
    const googleEvent = this.toGoogleEvent(event);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.status}`);
    }

    const created = await response.json();
    return { remoteId: created.id, etag: created.etag };
  }

  async updateRemoteEvent(
    remoteId: string,
    event: CalendarEvent,
  ): Promise<{ etag: string }> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = encodeURIComponent(
      this.externalCalendar.remote_calendar_id,
    );
    const googleEvent = this.toGoogleEvent(event);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${remoteId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.status}`);
    }

    const updated = await response.json();
    return { etag: updated.etag };
  }

  async deleteRemoteEvent(remoteId: string): Promise<void> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = encodeURIComponent(
      this.externalCalendar.remote_calendar_id,
    );

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${remoteId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete event: ${response.status}`);
    }
  }

  parseRemoteEvent(remote: RemoteEvent): CreateCalendarEventInput | null {
    if (typeof remote.data === "string") {
      console.warn("Google adapter expects JSON object data, not string");
      return null;
    }

    const googleEvent = remote.data as Record<string, unknown>;

    // Parse Google event to Kanso format
    const start = googleEvent.start as Record<string, string> | undefined;
    const end = googleEvent.end as Record<string, string> | undefined;

    if (!start) {
      return null;
    }

    const allDay = !!start.date && !start.dateTime;

    return {
      title: (googleEvent.summary as string) || "Untitled Event",
      description: googleEvent.description as string | undefined,
      location: googleEvent.location as string | undefined,
      start_time: allDay ? `${start.date}T00:00:00Z` : start.dateTime!,
      end_time: allDay
        ? `${end?.date || start.date}T23:59:59Z`
        : end?.dateTime || start.dateTime!,
      all_day: allDay,
      metadata: {
        google_event_id: googleEvent.id,
        google_etag: googleEvent.etag,
        google_html_link: googleEvent.htmlLink,
      },
    };
  }

  /**
   * Convert Kanso event to Google Calendar event format
   */
  private toGoogleEvent(event: CalendarEvent): Record<string, unknown> {
    const googleEvent: Record<string, unknown> = {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
    };

    if (event.all_day) {
      googleEvent.start = { date: event.start_time.split("T")[0] };
      googleEvent.end = { date: event.end_time.split("T")[0] };
    } else {
      googleEvent.start = { dateTime: event.start_time };
      googleEvent.end = { dateTime: event.end_time };
    }

    return googleEvent;
  }
}

// Register Google adapter (Premium tier)
registerAdapter("google", () => new GoogleCalendarAdapter());
