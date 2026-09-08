/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRawClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { needsEncryption, isJsonField } from "@/lib/supabase/wrapClient";
import { encryptField } from "@/lib/crypto/contentCipher";
import { keyStore } from "@/lib/crypto/keyStore";

export interface MigrationProgress {
  done: number;
  total: number;
  table: string;
}

interface PendingRow {
  table: string;
  id: string;
  updatedAt: string | null;
  row: Record<string, any>;
}

// labels and habit_imports lack updated_at in the schema.
const TABLES_WITH_UPDATED_AT = new Set([
  "tasks",
  "habits",
  "projects",
  "calendar_events",
  "external_calendars",
]);

// Raw client avoids decrypt-on-select to distinguish ciphertext from plaintext.
export async function findPendingRows(userId: string): Promise<PendingRow[]> {
  const raw = createRawClient();
  const pending: PendingRow[] = [];

  for (const [table, fields] of Object.entries(FIELD_MAP)) {
    if (!fields.length) continue;
    const hasUpdatedAt = TABLES_WITH_UPDATED_AT.has(table);
    const columns = [
      "id",
      ...(hasUpdatedAt ? ["updated_at"] : []),
      ...fields,
    ].join(",");
    const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
      (raw.from(table) as any)
        .select(columns)
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, to),
    );

    for (const row of rows) {
      if (fields.some((field) => needsEncryption(table, field, row[field]))) {
        pending.push({
          table,
          id: row.id as string,
          updatedAt: hasUpdatedAt ? (row.updated_at as string) : null,
          row,
        });
      }
    }
  }

  return pending;
}

// Evening and briefing notifications never carry user content (ADR 0016).
const CONTENT_NOTIFICATION_TYPES = ["due_date", "do_date", "timer_end"];

// Pre-migration queue rows contain unencrypted task content in payload.body.
async function cancelLegacyPlaintextNotifications(
  userId: string,
): Promise<void> {
  const raw = createRawClient();
  const rows = await fetchAllRows<{ id: string; payload: Record<string, any> }>(
    (from, to) =>
      (raw.from("notification_queue") as any)
        .select("id,payload")
        .eq("user_id", userId)
        .in("status", ["pending", "processing"])
        .in("type", CONTENT_NOTIFICATION_TYPES)
        .order("id", { ascending: true })
        .range(from, to),
  );

  const staleIds = rows
    .filter((row) => !row.payload?.encrypted)
    .map((row) => row.id);
  if (staleIds.length === 0) return;

  // Avoid cancelling rows delivered or failed concurrently by the queue worker.
  const { error } = await (raw.from("notification_queue") as any)
    .update({ status: "cancelled" })
    .in("id", staleIds)
    .in("status", ["pending", "processing"]);
  if (error) throw error;
}

// Diagnostic fields predating ADR 0016 redaction may contain plaintext.
async function scrubLegacyDiagnosticText(userId: string): Promise<void> {
  const raw = createRawClient();
  const { error: calendarError } = await (raw.from("external_calendars") as any)
    .update({ sync_error: null })
    .eq("user_id", userId)
    .not("sync_error", "is", null);
  if (calendarError) throw calendarError;

  const { error: notificationError } = await (
    raw.from("notification_queue") as any
  )
    .update({ error_message: null })
    .eq("user_id", userId)
    .not("error_message", "is", null);
  if (notificationError) throw notificationError;
}

export async function runBackfillMigration(
  userId: string,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<void> {
  const masterKey = await keyStore.load();
  if (!masterKey) {
    throw new Error("Cannot migrate: the content key is unavailable.");
  }

  await cancelLegacyPlaintextNotifications(userId);
  await scrubLegacyDiagnosticText(userId);

  const raw = createRawClient();
  const pending = await findPendingRows(userId);
  const total = pending.length;
  onProgress?.({ done: 0, total, table: pending[0]?.table ?? "" });

  for (let i = 0; i < pending.length; i++) {
    const { table, id, updatedAt, row } = pending[i];
    const fields = FIELD_MAP[table];
    const patch: Record<string, string> = {};

    for (const field of fields) {
      const value = row[field];
      if (!needsEncryption(table, field, value)) continue;
      const plaintext = isJsonField(table, field)
        ? JSON.stringify(value)
        : (value as string);
      patch[field] = await encryptField(masterKey, plaintext);
    }

    // Avoid overwriting concurrent writes with stale ciphertext.
    let query = (raw.from(table) as any)
      .update(patch)
      .eq("id", id)
      .select("id");
    if (updatedAt !== null) query = query.eq("updated_at", updatedAt);
    const { data, error } = await query;
    if (error) throw error;
    // Row changed concurrently and remains plaintext; fail loudly so retry picks it up.
    if (!data || data.length === 0) {
      throw new Error(
        `Migration conflict: ${table} row ${id} changed during migration. Retrying will pick it up.`,
      );
    }

    onProgress?.({ done: i + 1, total, table });
  }
}
