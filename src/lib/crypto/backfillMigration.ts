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

// labels and habit_imports lack an updated_at column in the schema.
const TABLES_WITH_UPDATED_AT = new Set([
  "tasks",
  "habits",
  "projects",
  "calendar_events",
  "external_calendars",
]);

// The raw client avoids decrypt-on-select so ciphertext can be distinguished from plaintext.
async function findPendingRows(userId: string): Promise<PendingRow[]> {
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

export async function runBackfillMigration(
  userId: string,
  onProgress?: (progress: MigrationProgress) => void,
): Promise<void> {
  const masterKey = await keyStore.load();
  if (!masterKey) {
    throw new Error("Cannot migrate: the content key is unavailable.");
  }

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

    // Optimistic lock: avoids clobbering concurrent writes with stale ciphertext.
    let query = (raw.from(table) as any).update(patch).eq("id", id);
    if (updatedAt !== null) query = query.eq("updated_at", updatedAt);
    const { error } = await query;
    if (error) throw error;

    onProgress?.({ done: i + 1, total, table });
  }
}
