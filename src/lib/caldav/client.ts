/* eslint-disable @typescript-eslint/no-explicit-any */
import { createDAVClient } from "tsdav";
import type { DiscoveredCalendar } from "@/lib/types/external-calendar";

export interface CalDAVCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Create a tsdav client with provided credentials
 */
export async function createCalDAVClient(
  credentials: CalDAVCredentials,
): Promise<any> {
  const client = await createDAVClient({
    serverUrl: credentials.serverUrl,
    credentials: {
      username: credentials.username,
      password: credentials.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  return client;
}

/**
 * Discover all calendars on a CalDAV server
 */
export async function discoverCalendars(
  credentials: CalDAVCredentials,
): Promise<DiscoveredCalendar[]> {
  const client = await createCalDAVClient(credentials);
  const calendars = await client.fetchCalendars();

  return calendars.map((cal: any) => ({
    url: cal.url,
    displayName: String(cal.displayName || "Unnamed Calendar"),
    description: cal.description,
    color: cal.calendarColor,
    ctag: cal.ctag,
  }));
}

/**
 * Fetch events from a calendar using sync token (incremental sync)
 */
export async function fetchCalendarEvents(
  client: any,
  calendarUrl: string,
  syncToken?: string,
): Promise<{
  events: Array<{ url: string; etag: string; data: string }>;
  syncToken: string;
  deleted: string[];
}> {
  // Use syncCollection for incremental sync if token exists
  if (syncToken) {
    const syncResult = await client.syncCollection({
      url: calendarUrl,
      syncToken,
      props: {
        getcontenttype: true,
        getetag: true,
        "calendar-data": true,
      },
    });

    const events = syncResult.filter(
      (item: any) => item.status !== 404 && item.props?.["calendar-data"],
    );
    const deleted = syncResult
      .filter((item: any) => item.status === 404)
      .map((item: any) => item.href);

    return {
      events: events.map((e: any) => ({
        url: e.href,
        etag: e.props?.getetag || "",
        data: e.props?.["calendar-data"] || "",
      })),
      syncToken: (syncResult as any)[0]?.syncToken || syncToken,
      deleted,
    };
  }

  // Full fetch for initial sync
  const objects = await client.fetchCalendarObjects({
    calendar: { url: calendarUrl },
  });

  return {
    events: objects.map((obj: any) => ({
      url: obj.url,
      etag: obj.etag || "",
      data: obj.data || "",
    })),
    syncToken: "", // Will be set from server response header
    deleted: [],
  };
}

/**
 * Create or update an event on the CalDAV server
 */
export async function pushEventToServer(
  client: any,
  calendarUrl: string,
  icsData: string,
  eventUrl?: string,
): Promise<{ url: string; etag: string }> {
  if (eventUrl) {
    // Update existing event
    const result = await client.updateCalendarObject({
      calendar: { url: calendarUrl },
      filename: eventUrl.split("/").pop() || `${crypto.randomUUID()}.ics`,
      iCalString: icsData,
    });
    return { url: eventUrl, etag: (result as any)?.etag || "" };
  }

  // Create new event
  const filename = `${crypto.randomUUID()}.ics`;
  const result = await client.createCalendarObject({
    calendar: { url: calendarUrl },
    filename,
    iCalString: icsData,
  });

  return {
    url: `${calendarUrl}/${filename}`,
    etag: (result as any)?.etag || "",
  };
}

/**
 * Delete an event from the CalDAV server
 */
export async function deleteEventFromServer(
  client: any,
  eventUrl: string,
): Promise<void> {
  await client.deleteCalendarObject({
    calendarObject: { url: eventUrl },
  });
}
