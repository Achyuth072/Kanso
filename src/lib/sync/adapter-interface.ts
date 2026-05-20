/**
 * Unified Sync Adapter Interface
 * Per RESEARCH.md Section 3.2: All adapters (CalDAV, Google, Microsoft) implement this interface
 * Enables provider-agnostic sync orchestration
 */

import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "@/lib/types/calendar-event";
import type {
  ExternalCalendar,
  CalendarProvider,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";

/**
 * Configuration for initializing a sync adapter
 */
export interface SyncAdapterConfig {
  externalCalendar: ExternalCalendar;
  /** CalDAV password (user-provided on each sync) */
  password?: string;
  /** OAuth access token (for Google/Microsoft, from Supabase Auth) */
  accessToken?: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  pushed: number;
  errors: string[];
  newSyncToken: string | null;
}

/**
 * Remote event representation (normalized across providers)
 */
export interface RemoteEvent {
  /** Provider-specific ID (URL for CalDAV, eventId for Google, id for MS) */
  remoteId: string;
  /** ETag or equivalent for change detection */
  etag: string;
  /** Raw ICS data (CalDAV) or normalized event object */
  data: string | Record<string, unknown>;
  /** Last modified timestamp */
  updatedAt?: Date;
}

/**
 * Sync delta from incremental sync
 */
export interface SyncDelta {
  created: RemoteEvent[];
  updated: RemoteEvent[];
  deleted: string[]; // Remote IDs of deleted events
  newSyncToken: string;
}

/**
 * Unified Sync Adapter Interface
 * All calendar sync adapters (CalDAV, Google, Microsoft) implement this
 */
export interface SyncAdapter {
  /** The provider this adapter handles */
  readonly provider: CalendarProvider;

  /**
   * Initialize the adapter with credentials/tokens
   * @throws Error if authentication fails
   */
  initialize(config: SyncAdapterConfig): Promise<void>;

  /**
   * Discover available calendars on the remote server
   * @returns List of calendars the user can sync
   */
  discoverCalendars(): Promise<DiscoveredCalendar[]>;

  /**
   * Perform full initial sync (no sync token)
   * @param timeWindowDays - Days before/after now to sync (default: 365*2)
   */
  fullSync(timeWindowDays?: number): Promise<{
    events: RemoteEvent[];
    syncToken: string;
  }>;

  /**
   * Perform incremental sync using stored sync token
   * @param syncToken - Previous sync token (CTag, nextSyncToken, deltaLink)
   */
  incrementalSync(syncToken: string): Promise<SyncDelta>;

  /**
   * Push a local event to the remote calendar
   * @returns Updated remote ID and etag
   */
  pushEvent(event: CalendarEvent): Promise<{ remoteId: string; etag: string }>;

  /**
   * Update an existing remote event
   * @param remoteId - The remote event's ID
   * @param event - Updated event data
   */
  updateRemoteEvent(
    remoteId: string,
    event: CalendarEvent,
  ): Promise<{ etag: string }>;

  /**
   * Delete an event from the remote calendar
   * @param remoteId - The remote event's ID
   */
  deleteRemoteEvent(remoteId: string): Promise<void>;

  /**
   * Convert remote event data to Kanso CalendarEvent input
   * Provider-specific parsing (ICS for CalDAV, JSON for Google/MS)
   */
  parseRemoteEvent(remote: RemoteEvent): CreateCalendarEventInput | null;
}

/**
 * Factory function type for creating adapters
 */
export type SyncAdapterFactory = (provider: CalendarProvider) => SyncAdapter;

/**
 * Registry of available sync adapters
 */
export const ADAPTER_REGISTRY: Partial<
  Record<CalendarProvider, () => SyncAdapter>
> = {};

/**
 * Register a sync adapter for a provider
 */
export function registerAdapter(
  provider: CalendarProvider,
  factory: () => SyncAdapter,
): void {
  ADAPTER_REGISTRY[provider] = factory;
}

/**
 * Get the appropriate sync adapter for a provider
 * @throws Error if no adapter registered for provider
 */
export function getAdapter(provider: CalendarProvider): SyncAdapter {
  const factory = ADAPTER_REGISTRY[provider];
  if (!factory) {
    throw new Error(`No sync adapter registered for provider: ${provider}`);
  }
  return factory();
}
