/**
 * External Calendar Types
 * Matches supabase external_calendars table schema
 * Supports: CalDAV (Free), Google (Premium), Outlook (Premium)
 */

export type SyncStatus = "pending" | "syncing" | "success" | "error";
export type SyncDirection = "bidirectional" | "pull" | "push";

/**
 * All supported calendar providers
 * - CalDAV-based: 'caldav', 'icloud', 'fastmail', 'nextcloud' (Free tier)
 * - Native API: 'google', 'outlook' (Premium tier per D-48-08)
 */
export type CalendarProvider =
  | "caldav"
  | "google"
  | "outlook"
  | "icloud"
  | "fastmail"
  | "nextcloud";

/**
 * Providers that use native OAuth APIs (Premium tier)
 */
export const PREMIUM_PROVIDERS: CalendarProvider[] = ["google", "outlook"];

/**
 * Providers that use CalDAV protocol (Free tier)
 */
export const CALDAV_PROVIDERS: CalendarProvider[] = [
  "caldav",
  "icloud",
  "fastmail",
  "nextcloud",
];

/**
 * Check if a provider requires premium subscription
 */
export function isPremiumProvider(provider: CalendarProvider): boolean {
  return PREMIUM_PROVIDERS.includes(provider);
}

export interface ExternalCalendar {
  id: string;
  user_id: string;

  // Provider Info
  provider: CalendarProvider;
  name: string;
  color: string;

  // Connection Details (varies by provider)
  server_url: string | null; // CalDAV only
  calendar_url: string | null;
  principal_url: string | null; // CalDAV only

  // Auth
  username: string | null; // CalDAV only

  // OAuth Provider Specifics (for Google/Outlook)
  oauth_provider_token_id: string | null;
  remote_calendar_id: string | null; // Google Calendar ID or Outlook folder ID

  // Sync State
  sync_token: string | null; // CTag (CalDAV), nextSyncToken (Google), deltaLink (MS Graph)
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;

  // Settings
  sync_enabled: boolean;
  sync_direction: SyncDirection;

  // Feature Gating
  is_premium_provider: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface CreateExternalCalendarInput {
  provider: CalendarProvider;
  name: string;
  color?: string;

  // CalDAV-specific (required for caldav/icloud/fastmail/nextcloud)
  server_url?: string;
  username?: string;

  // OAuth-specific (for google/outlook — populated from Supabase Auth)
  oauth_provider_token_id?: string;
  remote_calendar_id?: string;

  sync_direction?: SyncDirection;
}

export interface UpdateExternalCalendarInput {
  id: string;
  name?: string;
  color?: string;
  sync_enabled?: boolean;
  sync_direction?: SyncDirection;
  sync_token?: string;
  last_sync_at?: string;
  sync_status?: SyncStatus;
  sync_error?: string;
  calendar_url?: string;
  principal_url?: string;
  remote_calendar_id?: string;
}

/**
 * CalDAV discovery result
 */
export interface DiscoveredCalendar {
  url: string;
  displayName: string;
  description?: string;
  color?: string;
  ctag?: string;
}

/**
 * Google Calendar list item (from Google Calendar API)
 */
export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  primary?: boolean;
}

/**
 * Microsoft Graph calendar (from MS Graph API)
 */
export interface MicrosoftCalendarListItem {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
}
