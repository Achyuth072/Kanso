import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";

/**
 * Ensures all TEXT/VARCHAR/JSONB columns in schema.sql are classified as
 * encrypted in FIELD_MAP, pending encryption, scrubbed on write, or non-content.
 */

// User content fields pending encryption rollout.
const PENDING_CONTENT: Record<string, string[]> = {
  projects: ["name"],
  labels: ["name"],
  habits: ["name", "description"],
  calendar_events: ["title", "description", "location", "category", "metadata"],
  external_calendars: ["name", "username"],
  notification_queue: ["payload"],
  habit_imports: ["raw", "file_name"],
};

// Error columns scrubbed of user payloads on write rather than encrypted.
const SCRUBBED: Record<string, string[]> = {
  notification_queue: ["error_message"],
  external_calendars: ["sync_error"],
};

// Metadata, enums, settings, and non-content fields.
const NON_CONTENT: Record<string, string[]> = {
  profiles: ["display_name", "settings", "timezone"],
  projects: ["color", "view_style"],
  tasks: [
    "recurrence",
    "recurrence_settings",
    "google_event_id",
    "google_etag",
  ],
  labels: ["color"],
  push_subscriptions: ["endpoint", "subscription"],
  notification_queue: ["type", "status"],
  habits: ["color", "icon", "source_uuid"],
  habit_imports: ["source_app"],
  calendar_events: ["color", "recurrence_rule", "remote_id", "etag", "ics_uid"],
  external_calendars: [
    "provider",
    "color",
    "server_url",
    "calendar_url",
    "principal_url",
    "oauth_provider_token_id",
    "remote_calendar_id",
    "sync_token",
    "sync_status",
    "sync_direction",
  ],
  user_timer_state: ["mode", "source_device_id", "settings"],
  waitlist_signups: ["email", "cohort"],
  telemetry_events: ["event_name", "properties"],
  encryption_keys: [
    "passphrase_salt",
    "passphrase_kdf_params",
    "wrapped_key_passphrase",
    "recovery_salt",
    "recovery_kdf_params",
    "wrapped_key_recovery",
  ],
};

function mergeAll(...maps: Array<Record<string, string[]>>): Set<string> {
  const set = new Set<string>();
  for (const map of maps) {
    for (const [table, columns] of Object.entries(map)) {
      for (const column of columns) set.add(`${table}.${column}`);
    }
  }
  return set;
}

const fieldMapEntries = mergeAll(
  Object.fromEntries(
    Object.entries(FIELD_MAP).map(([table, cols]) => [table, [...cols]]),
  ),
);
const classifiedEntries = mergeAll(
  PENDING_CONTENT,
  SCRUBBED,
  NON_CONTENT,
  Object.fromEntries(
    Object.entries(FIELD_MAP).map(([table, cols]) => [table, [...cols]]),
  ),
);

function findTextAndJsonColumns(sql: string): string[] {
  const tablePattern =
    /CREATE TABLE IF NOT EXISTS (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g;
  const columnPattern = /^\s*(\w+)\s+(TEXT|VARCHAR\(\d+\)|JSONB)\b/;
  const found: string[] = [];

  for (const tableMatch of sql.matchAll(tablePattern)) {
    const table = tableMatch[1];
    const body = tableMatch[2];
    for (const line of body.split("\n")) {
      if (/^\s*(--|CONSTRAINT|UNIQUE|PRIMARY KEY)/.test(line)) continue;
      const columnMatch = line.match(columnPattern);
      if (columnMatch) found.push(`${table}.${columnMatch[1]}`);
    }
  }
  return found;
}

describe("field map covers every content-bearing column", () => {
  const schemaSql = readFileSync(
    path.resolve(__dirname, "../../../../supabase/schema.sql"),
    "utf-8",
  );
  const schemaColumns = findTextAndJsonColumns(schemaSql);

  it("found a non-trivial number of TEXT/JSONB columns (sanity check on the parser)", () => {
    expect(schemaColumns.length).toBeGreaterThan(40);
  });

  it("classifies every TEXT/JSONB column as FIELD_MAP, pending, scrubbed, or non-content", () => {
    const unclassified = schemaColumns.filter(
      (entry) => !classifiedEntries.has(entry),
    );
    expect(unclassified).toEqual([]);
  });

  it("has no stale classification for a column that no longer exists in the schema", () => {
    const schemaSet = new Set(schemaColumns);
    const stale = [...classifiedEntries].filter(
      (entry) => !schemaSet.has(entry),
    );
    expect(stale).toEqual([]);
  });

  it("covers task content and description — later tickets extend it to the remaining tables", () => {
    expect(fieldMapEntries).toEqual(
      new Set(["tasks.content", "tasks.description"]),
    );
  });
});
