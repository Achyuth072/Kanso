import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { FIELD_MAP, JSON_FIELDS } from "@/lib/supabase/fieldMap";
// Ciphertext envelopes resolved at display time.
const CIPHERTEXT_PASSTHROUGH: Record<string, string[]> = {
  notification_queue: ["payload"],
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
  CIPHERTEXT_PASSTHROUGH,
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

  it("classifies every TEXT/JSONB column as FIELD_MAP, ciphertext passthrough, scrubbed, or non-content", () => {
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

  it("covers tasks, habits, projects, labels, calendars, and imports — later tickets extend it to the remaining tables", () => {
    expect(fieldMapEntries).toEqual(
      new Set([
        "tasks.content",
        "tasks.description",
        "habits.name",
        "habits.description",
        "projects.name",
        "labels.name",
        "calendar_events.title",
        "calendar_events.description",
        "calendar_events.location",
        "calendar_events.category",
        "calendar_events.metadata",
        "external_calendars.name",
        "external_calendars.username",
        "habit_imports.raw",
        "habit_imports.file_name",
      ]),
    );
  });

  it("only marks encrypted columns as JSON", () => {
    const notEncrypted = [...JSON_FIELDS].filter(
      (entry) => !fieldMapEntries.has(entry),
    );
    expect(notEncrypted).toEqual([]);
  });
});
