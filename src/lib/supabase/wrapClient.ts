/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { keyStore } from "@/lib/crypto/keyStore";
import {
  encryptField,
  decryptField,
  isCiphertext,
} from "@/lib/crypto/contentCipher";
import { FIELD_MAP, JSON_FIELDS, type FieldMap } from "@/lib/supabase/fieldMap";

// Intercepts `.from(...)` queries only; `.channel` and `.rpc` bypass encryption.
export function wrapSupabaseClient<T extends SupabaseClient>(
  client: T,
  fieldMap: FieldMap = FIELD_MAP,
): T {
  return new Proxy(client, {
    get(target, prop, _receiver) {
      if (prop === "from") {
        return (table: string) =>
          wrapQueryBuilder(
            (target as any).from(table),
            String(table),
            fieldMap,
          );
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getContentKey(): Promise<Uint8Array | null> {
  return keyStore.load();
}

function createKeyLoader(): () => Promise<Uint8Array | null> {
  let pending: Promise<Uint8Array | null> | null = null;
  return () => (pending ??= getContentKey());
}

export function isJsonField(table: string, field: string): boolean {
  return JSON_FIELDS.has(`${table}.${field}`);
}

// Thrown on missing or locked content key, unlike PostgREST's resolved { data, error }.
export const CONTENT_KEY_UNAVAILABLE_CODE = "content_key_unavailable";

export function isContentKeyUnavailableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === CONTENT_KEY_UNAVAILABLE_CODE
  );
}

export function needsEncryption(
  table: string,
  field: string,
  value: unknown,
): boolean {
  if (isCiphertext(value)) return false;
  return isJsonField(table, field) ? value != null : typeof value === "string";
}

function rowNeedsEncryption(
  table: string,
  row: unknown,
  fields: readonly string[],
): boolean {
  return (
    isPlainObject(row) &&
    fields.some((field) => needsEncryption(table, field, row[field]))
  );
}

async function encryptRow(
  table: string,
  fields: readonly string[],
  row: unknown,
  key: Uint8Array,
): Promise<unknown> {
  if (!isPlainObject(row)) return row;

  const out = { ...row };
  for (const field of fields) {
    const value = row[field];
    if (needsEncryption(table, field, value)) {
      out[field] = await encryptField(
        key,
        isJsonField(table, field) ? JSON.stringify(value) : (value as string),
      );
    }
  }
  return out;
}

async function encryptPayload(
  table: string,
  fieldMap: FieldMap,
  values: unknown,
): Promise<unknown> {
  const fields = fieldMap[table];
  if (!fields?.length) return values;

  const rows = Array.isArray(values) ? values : [values];
  if (!rows.some((row) => rowNeedsEncryption(table, row, fields))) {
    return values;
  }

  const key = await getContentKey();
  if (!key) {
    throw Object.assign(
      new Error(
        `Cannot write to "${table}": content encryption is set up for this ` +
          "account but the master key is unavailable (locked, or not yet unlocked on this device).",
      ),
      { code: CONTENT_KEY_UNAVAILABLE_CODE },
    );
  }

  if (Array.isArray(values)) {
    return Promise.all(
      values.map((row) => encryptRow(table, fields, row, key)),
    );
  }
  return encryptRow(table, fields, values, key);
}

async function decryptRow(
  table: string,
  fieldMap: FieldMap,
  row: unknown,
  loadKey: () => Promise<Uint8Array | null>,
): Promise<unknown> {
  if (!isPlainObject(row)) return row;

  let out: Record<string, unknown> = row;
  const fields = fieldMap[table];
  if (fields?.length) {
    const key = await loadKey();
    for (const field of fields) {
      const value = out[field];
      if (isCiphertext(value)) {
        if (!key) {
          throw Object.assign(
            new Error(
              `Cannot read "${table}": content encryption is set up for this ` +
                "account but the master key is unavailable (locked, or not yet unlocked on this device).",
            ),
            { code: CONTENT_KEY_UNAVAILABLE_CODE },
          );
        }
        if (out === row) out = { ...row };
        const plaintext = await decryptField(key, value);
        out[field] = isJsonField(table, field)
          ? JSON.parse(plaintext)
          : plaintext;
      }
    }
  }

  // Recurse into embedded joins so joined encrypted fields are decrypted.
  for (const [column, value] of Object.entries(out)) {
    if (Array.isArray(value)) {
      if (!value.some(isPlainObject)) continue;
      const nested = await Promise.all(
        value.map((item) => decryptRow(column, fieldMap, item, loadKey)),
      );
      if (out === row) out = { ...row };
      out[column] = nested;
    } else if (isPlainObject(value)) {
      const nested = await decryptRow(column, fieldMap, value, loadKey);
      if (nested !== value) {
        if (out === row) out = { ...row };
        out[column] = nested;
      }
    }
  }

  return out;
}

async function decryptResult(
  table: string,
  fieldMap: FieldMap,
  result: any,
): Promise<any> {
  if (!isPlainObject(result) || result.error || result.data == null) {
    return result;
  }
  const loadKey = createKeyLoader();
  const data = Array.isArray(result.data)
    ? await Promise.all(
        result.data.map((row: unknown) =>
          decryptRow(table, fieldMap, row, loadKey),
        ),
      )
    : await decryptRow(table, fieldMap, result.data, loadKey);
  return { ...result, data };
}

function wrapFilterBuilder(
  builder: any,
  table: string,
  fieldMap: FieldMap,
): any {
  const proxy: any = new Proxy(builder, {
    get(target, prop, _receiver) {
      if (prop === "then") {
        return (onFulfilled?: any, onRejected?: any) =>
          Promise.resolve(target)
            .then((result: any) => decryptResult(table, fieldMap, result))
            .then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return result === target
          ? proxy
          : wrapFilterBuilder(result, table, fieldMap);
      };
    },
  });
  return proxy;
}

// Queues chained builder calls while awaiting encryption before delegating to PostgREST.
function wrapPendingBuilder(
  table: string,
  fieldMap: FieldMap,
  // Boxed in an object so Promise resolution does not auto-await the PostgREST thenable.
  resolveReal: () => Promise<{ builder: any }>,
): any {
  const ops: Array<{ prop: string; args: unknown[] }> = [];
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled?: any, onRejected?: any) =>
            resolveReal()
              .then(({ builder }) =>
                ops.reduce((acc, op) => acc[op.prop](...op.args), builder),
              )
              .then((result: any) => decryptResult(table, fieldMap, result))
              .then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          ops.push({ prop: String(prop), args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function wrapQueryBuilder(
  builder: any,
  table: string,
  fieldMap: FieldMap,
): any {
  return new Proxy(builder, {
    get(target, prop, _receiver) {
      if (prop === "insert" || prop === "update" || prop === "upsert") {
        const method = prop;
        return (values: unknown, options?: unknown) =>
          wrapPendingBuilder(table, fieldMap, async () => {
            const encrypted = await encryptPayload(table, fieldMap, values);
            return { builder: target[method](encrypted, options) };
          });
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      const bound = value.bind(target);
      if (prop === "select" || prop === "delete") {
        return (...args: unknown[]) =>
          wrapFilterBuilder(bound(...args), table, fieldMap);
      }
      return bound;
    },
  });
}
