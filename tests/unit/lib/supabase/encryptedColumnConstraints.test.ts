import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { encryptField } from "@/lib/crypto/contentCipher";

function findLengthCheckedColumns(sql: string): string[] {
  const found: string[] = [];
  const scopes = [
    /ALTER TABLE\s+(?:public\.)?(\w+)([\s\S]*?);/g,
    /CREATE TABLE IF NOT EXISTS (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g,
  ];

  for (const scope of scopes) {
    for (const [, table, body] of sql.matchAll(scope)) {
      for (const [, column] of body.matchAll(/char_length\(\s*(\w+)/g)) {
        found.push(`${table}.${column}`);
      }
    }
  }
  return found;
}

const schemaSql = readFileSync(
  path.resolve(__dirname, "../../../../supabase/schema.sql"),
  "utf-8",
);

describe("encrypted columns carry no length constraint", () => {
  it("finds a length check in both statement forms (sanity check on the parser)", () => {
    expect(
      findLengthCheckedColumns(`
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_content_length_check CHECK (char_length(content) <= 500);

CREATE TABLE IF NOT EXISTS public.notes (
  body TEXT CHECK (char_length(body) <= 10)
);
`),
    ).toEqual(["tasks.content", "notes.body"]);
  });

  it("leaves no encrypted column length-checked in schema.sql", () => {
    const encrypted = new Set(
      Object.entries(FIELD_MAP).flatMap(([table, columns]) =>
        columns.map((column) => `${table}.${column}`),
      ),
    );

    expect(
      findLengthCheckedColumns(schemaSql).filter((column) =>
        encrypted.has(column),
      ),
    ).toEqual([]);
  });

  it("overflows the old 500-char ceiling well inside the app's own content limit", async () => {
    const key = new Uint8Array(32).fill(7);
    const envelope = await encryptField(key, "a".repeat(500));

    expect(envelope.length).toBeGreaterThan(500);
  });
});
