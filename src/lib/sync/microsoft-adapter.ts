/**
 * Microsoft Graph Sync Adapter (Premium Tier)
 * Implements SyncAdapter for Outlook/Microsoft 365 calendars
 *
 * Per D-48-08: Built now, but feature-flagged as Premium
 */

import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  DiscoveredCalendar,
  CalendarProvider,
  MicrosoftCalendarListItem,
} from "@/lib/types/external-calendar";
import type {
  SyncAdapter,
  SyncAdapterConfig,
  SyncDelta,
  RemoteEvent,
} from "./adapter-interface";
import { registerAdapter } from "./adapter-interface";

const MS_GRAPH_API = "https://graph.microsoft.com/v1.0";

export class MicrosoftGraphAdapter implements SyncAdapter {
  readonly provider: CalendarProvider = "outlook";

  private accessToken: string | null = null;
  private externalCalendar: ExternalCalendar | null = null;

  async initialize(config: SyncAdapterConfig): Promise<void> {
    if (!config.accessToken) {
      throw new Error("Microsoft adapter requires OAuth accessToken in config");
    }

    this.accessToken = config.accessToken;
    this.externalCalendar = config.externalCalendar;

    // Validate token by making a simple API call
    const response = await fetch(`${MS_GRAPH_API}/me/calendars?$top=1`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph auth failed: ${response.status}`);
    }
  }

  async discoverCalendars(): Promise<DiscoveredCalendar[]> {
    if (!this.accessToken) {
      throw new Error("Adapter not initialized");
    }

    const response = await fetch(`${MS_GRAPH_API}/me/calendars`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.status}`);
    }

    const data = await response.json();
    const items: MicrosoftCalendarListItem[] = data.value || [];

    return items.map((cal) => ({
      url: cal.id, // MS Graph uses calendar ID
      displayName: cal.name,
      color: cal.color,
    }));
  }

  async fullSync(timeWindowDays: number = 730): Promise<{
    events: RemoteEvent[];
    syncToken: string;
  }> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = this.externalCalendar.remote_calendar_id;
    const startDateTime = new Date(
      Date.now() - timeWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const endDateTime = new Date(
      Date.now() + timeWindowDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Use calendarView for time-windowed query
    const url = `${MS_GRAPH_API}/me/calendars/${calendarId}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    const data = await response.json();

    // Get delta link for incremental sync
    const deltaUrl = `${MS_GRAPH_API}/me/calendars/${calendarId}/events/delta`;
    const deltaResponse = await fetch(deltaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    let deltaLink = "";
    if (deltaResponse.ok) {
      const deltaData = await deltaResponse.json();
      deltaLink = deltaData["@odata.deltaLink"] || "";
    }

    return {
      events: (data.value || []).map((item: Record<string, unknown>) => ({
        remoteId: item.id as string,
        etag: (item["@odata.etag"] as string) || "",
        data: item,
        updatedAt: item.lastModifiedDateTime
          ? new Date(item.lastModifiedDateTime as string)
          : undefined,
      })),
      syncToken: deltaLink,
    };
  }

  async incrementalSync(syncToken: string): Promise<SyncDelta> {
    if (!this.accessToken) {
      throw new Error("Adapter not initialized");
    }

    const response = await fetch(syncToken, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 410) {
        throw new Error("SYNC_TOKEN_EXPIRED");
      }
      throw new Error(`Incremental sync failed: ${response.status}`);
    }

    const data = await response.json();
    const items = data.value || [];

    const deleted: string[] = [];
    const updated: RemoteEvent[] = [];

    for (const item of items) {
      if (item["@removed"]) {
        deleted.push(item.id as string);
      } else {
        updated.push({
          remoteId: item.id as string,
          etag: (item["@odata.etag"] as string) || "",
          data: item,
          updatedAt: item.lastModifiedDateTime
            ? new Date(item.lastModifiedDateTime as string)
            : undefined,
        });
      }
    }

    return {
      created: [],
      updated,
      deleted,
      newSyncToken: data["@odata.deltaLink"] || syncToken,
    };
  }

  async pushEvent(
    event: CalendarEvent,
  ): Promise<{ remoteId: string; etag: string }> {
    if (!this.accessToken || !this.externalCalendar?.remote_calendar_id) {
      throw new Error("Adapter not initialized or remote_calendar_id not set");
    }

    const calendarId = this.externalCalendar.remote_calendar_id;
    const msEvent = this.toMicrosoftEvent(event);

    const response = await fetch(
      `${MS_GRAPH_API}/me/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(msEvent),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.status}`);
    }

    const created = await response.json();
    return { remoteId: created.id, etag: created["@odata.etag"] || "" };
  }

  async updateRemoteEvent(
    remoteId: string,
    event: CalendarEvent,
  ): Promise<{ etag: string }> {
    if (!this.accessToken) {
      throw new Error("Adapter not initialized");
    }

    const msEvent = this.toMicrosoftEvent(event);

    const response = await fetch(`${MS_GRAPH_API}/me/events/${remoteId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msEvent),
    });

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.status}`);
    }

    const updated = await response.json();
    return { etag: updated["@odata.etag"] || "" };
  }

  async deleteRemoteEvent(remoteId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error("Adapter not initialized");
    }

    const response = await fetch(`${MS_GRAPH_API}/me/events/${remoteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete event: ${response.status}`);
    }
  }

  parseRemoteEvent(remote: RemoteEvent): CreateCalendarEventInput | null {
    if (typeof remote.data === "string") {
      console.warn("Microsoft adapter expects JSON object data, not string");
      return null;
    }

    const msEvent = remote.data as Record<string, unknown>;
    const start = msEvent.start as Record<string, string> | undefined;
    const end = msEvent.end as Record<string, string> | undefined;

    if (!start) {
      return null;
    }

    const allDay = (msEvent.isAllDay as boolean) || false;

    return {
      title: (msEvent.subject as string) || "Untitled Event",
      description: msEvent.bodyPreview as string | undefined,
      location: (msEvent.location as Record<string, string>)?.displayName,
      start_time: start.dateTime + "Z", // MS Graph uses UTC
      end_time: end?.dateTime ? end.dateTime + "Z" : start.dateTime + "Z",
      all_day: allDay,
      metadata: {
        ms_event_id: msEvent.id,
        ms_etag: msEvent["@odata.etag"],
        ms_web_link: msEvent.webLink,
      },
    };
  }

  private toMicrosoftEvent(event: CalendarEvent): Record<string, unknown> {
    const msEvent: Record<string, unknown> = {
      subject: event.title,
      body: event.description
        ? {
            contentType: "text",
            content: event.description,
          }
        : undefined,
      isAllDay: event.all_day,
    };

    if (event.location) {
      msEvent.location = { displayName: event.location };
    }

    const startTime = event.start_time.replace("Z", "");
    const endTime = event.end_time.replace("Z", "");

    msEvent.start = { dateTime: startTime, timeZone: "UTC" };
    msEvent.end = { dateTime: endTime, timeZone: "UTC" };

    return msEvent;
  }
}

// Register Microsoft adapter (Premium tier)
registerAdapter("outlook", () => new MicrosoftGraphAdapter());
