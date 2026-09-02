import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP, type FieldMap } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext, encryptField } from "@/lib/crypto/contentCipher";
import {
  createFakeSupabaseClient,
  type Row,
} from "../../support/fakeSupabaseClient";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
});

describe("wrapSupabaseClient — with a populated field map", () => {
  const testFieldMap: FieldMap = { tasks: ["content", "description"] };

  it("stores an inserted row as ciphertext and reads back the plaintext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data: inserted, error } = await client
      .from("tasks")
      .insert({ content: "Buy milk", priority: 1 })
      .select()
      .single();

    expect(error).toBeNull();
    expect(inserted.content).toBe("Buy milk");
    expect(inserted.priority).toBe(1);

    const stored = raw.rawRows("tasks")[0];
    expect(isCiphertext(stored.content)).toBe(true);
    expect(stored.priority).toBe(1);

    const { data: read } = await client
      .from("tasks")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.content).toBe("Buy milk");
  });

  it("encrypts every row in an array insert", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .insert([{ content: "First" }, { content: "Second" }])
      .select();

    expect(data.map((r: Row) => r.content)).toEqual(["First", "Second"]);
    for (const row of raw.rawRows("tasks")) {
      expect(isCiphertext(row.content)).toBe(true);
    }
  });

  it("encrypts on update and upsert", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "old", user_id: "u1" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    await client
      .from("tasks")
      .update({ content: "new" })
      .eq("id", "t1")
      .select()
      .single();
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);

    await client
      .from("tasks")
      .upsert({ id: "t1", content: "upserted" }, { onConflict: "id" });
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);
  });

  it("does not double-encrypt a value that is already ciphertext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const alreadyEncrypted = await encryptField(
      keyStoreState.key!,
      "already encrypted",
    );

    await client.from("tasks").insert({ content: alreadyEncrypted });

    expect(raw.rawRows("tasks")[0].content).toBe(alreadyEncrypted);
  });

  it("passes an untagged (plaintext) value through unchanged on read", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "pre-existing plaintext row" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .single();
    expect(data.content).toBe("pre-existing plaintext row");
  });

  it("decrypts nested objects from an embedded select", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, {
      tasks: ["content"],
      projects: ["name"],
    });

    await client.from("projects").insert({ name: "Secret project" });
    await client.from("tasks").insert({ id: "t1", content: "task" });

    // Simulates PostgREST nested relation response structure.
    const rawTask = raw.rawRows("tasks").find((r: Row) => r.id === "t1");
    rawTask.projects = raw.rawRows("projects")[0];
    expect(isCiphertext(rawTask.content)).toBe(true);
    expect(isCiphertext(rawTask.projects.name)).toBe(true);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .maybeSingle();
    expect(data.content).toBe("task");
    expect(data.projects.name).toBe("Secret project");
  });

  it("leaves a table absent from the field map completely untouched", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("profiles")
      .insert({ display_name: "Ada" })
      .select()
      .single();

    expect(data.display_name).toBe("Ada");
    expect(raw.rawRows("profiles")[0].display_name).toBe("Ada");
  });

  it("throws rather than silently writing plaintext when the key is unavailable", async () => {
    keyStoreState.key = null;
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    await expect(
      client.from("tasks").insert({ content: "should not be written" }),
    ).rejects.toThrow();
    expect(raw.rawRows("tasks")).toHaveLength(0);
  });
});

describe("wrapSupabaseClient — with the real field map", () => {
  it("the defining test: writes a task through the wrapped client, reads it back, and the stored row is ciphertext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: inserted } = await client
      .from("tasks")
      .insert({ content: "Buy milk", description: "2%", priority: 1 })
      .select()
      .single();

    expect(inserted.content).toBe("Buy milk");
    expect(inserted.description).toBe("2%");

    const stored = raw.rawRows("tasks")[0];
    expect(isCiphertext(stored.content)).toBe(true);
    expect(isCiphertext(stored.description)).toBe(true);
    expect(stored.priority).toBe(1);

    const { data: read } = await client
      .from("tasks")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.content).toBe("Buy milk");
    expect(read.description).toBe("2%");
  });

  it("still passes a table absent from the field map through unchanged, round-tripping arrays, single(), and maybeSingle()", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("habits").insert([{ name: "Read" }, { name: "Run" }]);
    const { data: all } = await client.from("habits").select().limit(10);
    expect(all.map((r: Row) => r.name)).toEqual(["Read", "Run"]);
    expect(isCiphertext(raw.rawRows("habits")[0].name)).toBe(false);

    const { data: single } = await client
      .from("habits")
      .select()
      .eq("name", "Read")
      .single();
    expect(single.name).toBe("Read");

    const { data: maybe } = await client
      .from("habits")
      .select()
      .eq("name", "missing")
      .maybeSingle();
    expect(maybe).toBeNull();
  });
});
