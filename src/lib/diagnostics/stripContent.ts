import { FIELD_MAP } from "@/lib/supabase/fieldMap";

export function stripContent<T extends object>(
  table: keyof typeof FIELD_MAP,
  row: T,
): Partial<T> {
  const contentFields = new Set<string>(FIELD_MAP[table] ?? []);
  const structural: Partial<T> = {};
  for (const key of Object.keys(row) as (keyof T)[]) {
    if (!contentFields.has(key as string)) {
      structural[key] = row[key];
    }
  }
  return structural;
}
