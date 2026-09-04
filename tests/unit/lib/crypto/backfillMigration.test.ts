import { describe, it, expect, vi, beforeEach } from "vitest";
import { runBackfillMigration } from "@/lib/crypto/backfillMigration";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { isCiphertext, encryptField } from "@/lib/crypto/contentCipher";
import { generateMasterKey } from "@/lib/crypto/masterKey";
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

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
vi.mock("@/lib/supabase/client", () => ({
  createRawClient: () => fakeClient,
}));

const USER_ID = "user-1";

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
});

describe("runBackfillMigration", () => {
  it("encrypts every mapped field, across every field-map table, for the owning user", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        {
          id: "t1",
          user_id: USER_ID,
          content: "Buy milk",
          description: "2%",
        },
      ],
      habits: [
        { id: "h1", user_id: USER_ID, name: "Meditate", description: null },
      ],
      projects: [{ id: "p1", user_id: USER_ID, name: "Divorce planning" }],
    });

    const progressCalls: Array<{ done: number; total: number }> = [];
    await runBackfillMigration(USER_ID, (p) =>
      progressCalls.push({ done: p.done, total: p.total }),
    );

    const task = fakeClient.rawRows("tasks")[0];
    expect(isCiphertext(task.content)).toBe(true);
    expect(isCiphertext(task.description)).toBe(true);

    const habit = fakeClient.rawRows("habits")[0];
    expect(isCiphertext(habit.name)).toBe(true);
    expect(habit.description).toBeNull();

    const project = fakeClient.rawRows("projects")[0];
    expect(isCiphertext(project.name)).toBe(true);

    expect(progressCalls.at(-1)).toEqual({ done: 3, total: 3 });
  });

  it("skips rows that only belong to a different user", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        { id: "t1", user_id: "someone-else", content: "Not mine" },
        { id: "t2", user_id: USER_ID, content: "Mine" },
      ],
    });

    await runBackfillMigration(USER_ID);

    const rows = fakeClient.rawRows("tasks");
    expect(rows.find((r: Row) => r.id === "t1").content).toBe("Not mine");
    expect(isCiphertext(rows.find((r: Row) => r.id === "t2").content)).toBe(
      true,
    );
  });

  it("JSON fields: stringifies before encrypting and leaves null untouched", async () => {
    fakeClient = createFakeSupabaseClient({
      calendar_events: [
        {
          id: "e1",
          user_id: USER_ID,
          title: "Therapy",
          description: null,
          location: null,
          category: null,
          metadata: { attendees: ["a@example.com"] },
        },
      ],
      habit_imports: [
        {
          id: "i1",
          user_id: USER_ID,
          raw: { entries: [1, 2, 3] },
          file_name: "export.db",
        },
      ],
    });

    await runBackfillMigration(USER_ID);

    const event = fakeClient.rawRows("calendar_events")[0];
    expect(isCiphertext(event.title)).toBe(true);
    expect(isCiphertext(event.metadata)).toBe(true);
    expect(event.description).toBeNull();

    const habitImport = fakeClient.rawRows("habit_imports")[0];
    expect(isCiphertext(habitImport.raw)).toBe(true);
    expect(isCiphertext(habitImport.file_name)).toBe(true);
  });

  it("is resumable: an interrupted pass can be re-run and every row ends encrypted exactly once", async () => {
    let updatesAllowed = 1;
    fakeClient = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", user_id: USER_ID, content: "First" },
          { id: "t2", user_id: USER_ID, content: "Second" },
          { id: "t3", user_id: USER_ID, content: "Third" },
        ],
      },
      {
        failWrite: (ctx) => {
          if (ctx.table === "tasks" && ctx.kind === "update") {
            if (updatesAllowed-- <= 0) return { message: "interrupted" };
          }
          return null;
        },
      },
    );

    await expect(runBackfillMigration(USER_ID)).rejects.toBeTruthy();

    const midway = fakeClient.rawRows("tasks");
    const encryptedCount = midway.filter((r: Row) =>
      isCiphertext(r.content),
    ).length;
    expect(encryptedCount).toBe(1);

    fakeClient = createFakeSupabaseClient({ tasks: midway });
    await runBackfillMigration(USER_ID);

    const final = fakeClient.rawRows("tasks");
    expect(final.every((r: Row) => isCiphertext(r.content))).toBe(true);
    expect(final.map((r: Row) => r.id).sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("does not double-encrypt a row that is already ciphertext", async () => {
    const alreadyEncrypted = await encryptField(
      keyStoreState.key!,
      "already migrated",
    );
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: alreadyEncrypted }],
    });

    await runBackfillMigration(USER_ID);

    expect(fakeClient.rawRows("tasks")[0].content).toBe(alreadyEncrypted);
  });

  it("throws rather than silently skipping when the key is unavailable", async () => {
    keyStoreState.key = null;
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "plaintext" }],
    });

    await expect(runBackfillMigration(USER_ID)).rejects.toThrow();
    expect(fakeClient.rawRows("tasks")[0].content).toBe("plaintext");
  });

  it("never touches a table outside the field map, such as profiles carrying is_premium", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "Task" }],
      profiles: [{ id: USER_ID, is_premium: true, display_name: "Ada" }],
    });

    await runBackfillMigration(USER_ID);

    expect(FIELD_MAP.profiles).toBeUndefined();
    expect(fakeClient.rawRows("profiles")[0]).toEqual({
      id: USER_ID,
      is_premium: true,
      display_name: "Ada",
    });
  });

  it("reports progress incrementally rather than only at the end", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        { id: "t1", user_id: USER_ID, content: "One" },
        { id: "t2", user_id: USER_ID, content: "Two" },
      ],
    });

    const calls: number[] = [];
    await runBackfillMigration(USER_ID, (p) => calls.push(p.done));

    expect(calls).toContain(1);
    expect(calls).toContain(2);
  });
});
