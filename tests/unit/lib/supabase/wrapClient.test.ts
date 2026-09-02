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

    await client
      .from("focus_logs")
      .insert([{ task_id: "t1" }, { task_id: "t2" }]);
    const { data: all } = await client.from("focus_logs").select().limit(10);
    expect(all.map((r: Row) => r.task_id)).toEqual(["t1", "t2"]);
    expect(isCiphertext(raw.rawRows("focus_logs")[0].task_id)).toBe(false);

    const { data: single } = await client
      .from("focus_logs")
      .select()
      .eq("task_id", "t1")
      .single();
    expect(single.task_id).toBe("t1");

    const { data: maybe } = await client
      .from("focus_logs")
      .select()
      .eq("task_id", "missing")
      .maybeSingle();
    expect(maybe).toBeNull();
  });

  it("stores an inserted habit and project as ciphertext and reads back the plaintext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: habit } = await client
      .from("habits")
      .insert({ name: "Take medication", description: "Twice daily" })
      .select()
      .single();
    expect(habit.name).toBe("Take medication");
    expect(habit.description).toBe("Twice daily");
    expect(isCiphertext(raw.rawRows("habits")[0].name)).toBe(true);
    expect(isCiphertext(raw.rawRows("habits")[0].description)).toBe(true);

    const { data: project } = await client
      .from("projects")
      .insert({ name: "Divorce planning" })
      .select()
      .single();
    expect(project.name).toBe("Divorce planning");
    expect(isCiphertext(raw.rawRows("projects")[0].name)).toBe(true);

    const { data: label } = await client
      .from("labels")
      .insert({ name: "Urgent" })
      .select()
      .single();
    expect(label.name).toBe("Urgent");
    expect(isCiphertext(raw.rawRows("labels")[0].name)).toBe(true);
  });

  it("encrypts calendar event content and the metadata JSONB, leaving times and sync identifiers readable", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const metadata = {
      attendees: ["ada@example.com"],
      organizer: "grace@example.com",
      conference_url: "https://meet.example.com/xyz",
    };
    const { data: event } = await client
      .from("calendar_events")
      .insert({
        title: "Oncology follow-up",
        description: "Bring scan results",
        location: "St Mary's, room 4",
        category: "health",
        start_time: "2026-09-03T09:00:00Z",
        end_time: "2026-09-03T10:00:00Z",
        all_day: false,
        color: "#4B6CB7",
        recurrence_rule: "FREQ=WEEKLY",
        remote_id: "google-event-123",
        etag: 'W/"abc"',
        ics_uid: "uid-1",
        metadata,
      })
      .select()
      .single();

    expect(event.title).toBe("Oncology follow-up");
    expect(event.metadata).toEqual(metadata);

    const stored = raw.rawRows("calendar_events")[0];
    for (const field of [
      "title",
      "description",
      "location",
      "category",
      "metadata",
    ]) {
      expect(isCiphertext(stored[field])).toBe(true);
    }
    expect(stored.start_time).toBe("2026-09-03T09:00:00Z");
    expect(stored.end_time).toBe("2026-09-03T10:00:00Z");
    expect(stored.all_day).toBe(false);
    expect(stored.color).toBe("#4B6CB7");
    expect(stored.recurrence_rule).toBe("FREQ=WEEKLY");
    expect(stored.remote_id).toBe("google-event-123");
    expect(stored.etag).toBe('W/"abc"');
    expect(stored.ics_uid).toBe("uid-1");

    const { data: read } = await client
      .from("calendar_events")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.title).toBe("Oncology follow-up");
    expect(read.description).toBe("Bring scan results");
    expect(read.location).toBe("St Mary's, room 4");
    expect(read.category).toBe("health");
    expect(read.metadata).toEqual(metadata);
  });

  it("leaves a null metadata untouched rather than encrypting the absence of one", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client
      .from("calendar_events")
      .update({ metadata: null, sync_state: null })
      .eq("id", "missing");

    await client
      .from("calendar_events")
      .insert({ title: "No metadata", metadata: null });
    expect(raw.rawRows("calendar_events")[0].metadata).toBeNull();
  });

  it("encrypts the connected-calendar name and CalDAV username, leaving provider and URLs readable", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: calendar } = await client
      .from("external_calendars")
      .insert({
        provider: "caldav",
        name: "Therapy",
        username: "ada@example.com",
        server_url: "https://caldav.example.com",
        remote_calendar_id: "cal-1",
      })
      .select()
      .single();

    expect(calendar.name).toBe("Therapy");
    expect(calendar.username).toBe("ada@example.com");

    const stored = raw.rawRows("external_calendars")[0];
    expect(isCiphertext(stored.name)).toBe(true);
    expect(isCiphertext(stored.username)).toBe(true);
    expect(stored.provider).toBe("caldav");
    expect(stored.server_url).toBe("https://caldav.example.com");
    expect(stored.remote_calendar_id).toBe("cal-1");
  });

  it("passes a sync-status update through without needing the key", async () => {
    const raw = createFakeSupabaseClient({
      external_calendars: [{ id: "c1", name: "Therapy" }],
    });
    const client = wrapSupabaseClient(raw, FIELD_MAP);
    keyStoreState.key = null;

    await client
      .from("external_calendars")
      .update({ sync_status: "syncing" })
      .eq("id", "c1");

    expect(raw.rawRows("external_calendars")[0].sync_status).toBe("syncing");
  });
});
