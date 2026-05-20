/**
 * CalDAV Sync Adapter
 * Implements SyncAdapter for CalDAV-compatible providers (iCloud, Fastmail, Nextcloud)
 * Uses tsdav library for CalDAV operations
 */

import type { DAVClient } from "tsdav";
import {
  toCalendarEventUI,
  type CalendarEvent,
  type CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  DiscoveredCalendar,
  CalendarProvider,
} from "@/lib/types/external-calendar";
import type {
  SyncAdapter,
  SyncAdapterConfig,
  RemoteEvent,
  SyncDelta,
} from "./adapter-interface";
import { registerAdapter } from "./adapter-interface";
import {
  createCalDAVClient,
  discoverCalendars as caldavDiscover,
  fetchCalendarEvents,
  pushEventToServer,
  deleteEventFromServer,
} from "@/lib/caldav/client";
import { parseICS } from "@/lib/utils/ics-parser";
import { generateICS } from "@/lib/utils/ics-generator";

export class CalDAVAdapter implements SyncAdapter {
  readonly provider: CalendarProvider = "caldav";

  private client: DAVClient | null = null;
  private externalCalendar: ExternalCalendar | null = null;
  private password: string | null = null;

  async initialize(config: SyncAdapterConfig): Promise<void> {
    if (!config.password) {
      throw new Error("CalDAV adapter requires password in config");
    }
    if (!config.externalCalendar.server_url) {
      throw new Error(
        "CalDAV adapter requires server_url in external calendar",
      );
    }
    if (!config.externalCalendar.username) {
      throw new Error("CalDAV adapter requires username in external calendar");
    }

    this.externalCalendar = config.externalCalendar;
    this.password = config.password;

    this.client = await createCalDAVClient({
      serverUrl: config.externalCalendar.server_url,
      username: config.externalCalendar.username,
      password: config.password,
    });
  }

  async discoverCalendars(): Promise<DiscoveredCalendar[]> {
    if (!this.externalCalendar || !this.password) {
      throw new Error("Adapter not initialized");
    }

    return caldavDiscover({
      serverUrl: this.externalCalendar.server_url!,
      username: this.externalCalendar.username!,
      password: this.password,
    });
  }

  async fullSync(_timeWindowDays: number = 730): Promise<{
    events: RemoteEvent[];
    syncToken: string;
  }> {
    if (!this.client || !this.externalCalendar?.calendar_url) {
      throw new Error("Adapter not initialized or calendar_url not set");
    }

    const result = await fetchCalendarEvents(
      this.client,
      this.externalCalendar.calendar_url,
      undefined, // No sync token = full sync
    );

    return {
      events: result.events.map((e) => ({
        remoteId: e.url,
        etag: e.etag,
        data: e.data,
      })),
      syncToken: result.syncToken,
    };
  }

  async incrementalSync(syncToken: string): Promise<SyncDelta> {
    if (!this.client || !this.externalCalendar?.calendar_url) {
      throw new Error("Adapter not initialized or calendar_url not set");
    }

    const result = await fetchCalendarEvents(
      this.client,
      this.externalCalendar.calendar_url,
      syncToken,
    );

    return {
      created: [], // Caller determines this
      updated: result.events.map((e) => ({
        remoteId: e.url,
        etag: e.etag,
        data: e.data,
      })),
      deleted: result.deleted,
      newSyncToken: result.syncToken,
    };
  }

  async pushEvent(
    event: CalendarEvent,
  ): Promise<{ remoteId: string; etag: string }> {
    if (!this.client || !this.externalCalendar?.calendar_url) {
      throw new Error("Adapter not initialized or calendar_url not set");
    }

    const icsData = generateICS([toCalendarEventUI(event)]);
    const result = await pushEventToServer(
      this.client,
      this.externalCalendar.calendar_url,
      icsData,
      undefined, // No existing URL = create new
    );

    return { remoteId: result.url, etag: result.etag };
  }

  async updateRemoteEvent(
    remoteId: string,
    event: CalendarEvent,
  ): Promise<{ etag: string }> {
    if (!this.client || !this.externalCalendar?.calendar_url) {
      throw new Error("Adapter not initialized or calendar_url not set");
    }

    const icsData = generateICS([toCalendarEventUI(event)]);
    const result = await pushEventToServer(
      this.client,
      this.externalCalendar.calendar_url,
      icsData,
      remoteId,
    );

    return { etag: result.etag };
  }

  async deleteRemoteEvent(remoteId: string): Promise<void> {
    if (!this.client) {
      throw new Error("Adapter not initialized");
    }

    await deleteEventFromServer(this.client, remoteId);
  }

  parseRemoteEvent(remote: RemoteEvent): CreateCalendarEventInput | null {
    if (typeof remote.data !== "string") {
      console.warn("CalDAV adapter expects ICS string data");
      return null;
    }

    const { events, errors } = parseICS(remote.data);

    if (errors.length > 0) {
      console.warn(`Parse errors for ${remote.remoteId}:`, errors);
    }

    if (events.length === 0) {
      return null;
    }

    return events[0];
  }
}

// Register CalDAV adapter for all CalDAV-based providers
registerAdapter("caldav", () => new CalDAVAdapter());
registerAdapter("icloud", () => new CalDAVAdapter());
registerAdapter("fastmail", () => new CalDAVAdapter());
registerAdapter("nextcloud", () => new CalDAVAdapter());
