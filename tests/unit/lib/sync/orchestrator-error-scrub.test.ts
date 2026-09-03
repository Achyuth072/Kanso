import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import type { SyncAdapter } from "@/lib/sync/adapter-interface";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";
import {
  createFakeSupabaseClient,
  type FailWrite,
  type Row,
} from "../../support/fakeSupabaseClient";

const SECRET_TITLE = "Oncology follow-up with Dr Bhatt";
const START = "2026-09-03T09:00:00Z";
const END = "2026-09-03T10:00:00Z";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

const backend = { raw: createFakeSupabaseClient() };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => wrapSupabaseClient(backend.raw, FIELD_MAP),
}));

const { syncExternalCalendar, applyPullMutations } =
  await import("@/lib/sync/orchestrator");
const { registerAdapter } = await import("@/lib/sync/adapter-interface");

const calendarRow = {
  id: "cal-1",
  user_id: "user-1",
  provider: "caldav",
  sync_direction: "pull",
  sync_token: null,
};

function seedBackend(failWrite?: FailWrite) {
  backend.raw = createFakeSupabaseClient(
    { external_calendars: [{ ...calendarRow }] },
    { failWrite },
  );
}

function registerFakeAdapter(fullSync: SyncAdapter["fullSync"]) {
  registerAdapter("caldav", () => ({
    provider: "caldav",
    initialize: async () => {},
    listCalendars: async () => [],
    discoverCalendars: async () => [],
    fullSync,
    incrementalSync: async () => ({
      created: [],
      updated: [],
      deleted: [],
      newSyncToken: "",
    }),
    pushEvent: async () => ({ remoteId: "r", etag: "e" }),
    updateRemoteEvent: async () => ({ etag: "e" }),
    deleteRemoteEvent: async () => {},
    parseRemoteEvent: (remote) =>
      remote.data as unknown as CreateCalendarEventInput,
  }));
}

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  seedBackend();
});

describe("sync errors persisted to external_calendars.sync_error", () => {
  it("does not persist content from a failing write's payload", async () => {
    seedBackend(({ table, kind }) =>
      table === "calendar_events" && kind === "insert"
        ? {
            message: `new row for relation "calendar_events" violates check constraint — Failing row contains (${SECRET_TITLE})`,
            code: "23514",
            name: "PostgrestError",
          }
        : null,
    );

    registerFakeAdapter(async () => ({
      events: [
        {
          remoteId: "remote-1",
          etag: "etag-1",
          data: {
            title: SECRET_TITLE,
            start_time: START,
            end_time: END,
            all_day: false,
          },
        },
      ],
      syncToken: "token-1",
    }));

    const result = await syncExternalCalendar("cal-1");

    expect(result.errors).toHaveLength(1);
    const stored = backend.raw.rawRows("external_calendars")[0] as Row;
    expect(stored.sync_status).toBe("error");
    expect(stored.sync_error).toBeTruthy();
    expect(stored.sync_error).not.toContain(SECRET_TITLE);
    expect(stored.sync_error).not.toContain("Bhatt");
    expect(stored.sync_error).toContain("PostgrestError");
    expect(stored.sync_error).toContain("code=23514");
  });

  it("does not persist content from a thrown provider error", async () => {
    registerFakeAdapter(async () => {
      throw new Error(`Provider rejected event: ${SECRET_TITLE}`);
    });

    await syncExternalCalendar("cal-1");

    const stored = backend.raw.rawRows("external_calendars")[0] as Row;
    expect(stored.sync_error).not.toContain(SECRET_TITLE);
    expect(stored.sync_error).toBe("Error");
  });

  it("keeps the failing row's id so the operator can still locate it", async () => {
    const result = await applyPullMutations(
      {
        toCreate: [],
        toUpdate: [
          {
            id: "event-9",
            etag: "etag-1",
            data: { title: SECRET_TITLE, start_time: START, end_time: END },
            clearSyncState: false,
          },
        ],
        toArchive: [],
        toHardDelete: [],
        toAdopt: [],
      },
      { id: "cal-1", user_id: "user-1" },
    );

    expect(result.errors).toEqual([]);

    seedBackend(({ table, kind }) =>
      table === "calendar_events" && kind === "update"
        ? { message: `cannot update ${SECRET_TITLE}`, name: "PostgrestError" }
        : null,
    );

    const failed = await applyPullMutations(
      {
        toCreate: [],
        toUpdate: [
          {
            id: "event-9",
            etag: "etag-1",
            data: { title: SECRET_TITLE, start_time: START, end_time: END },
            clearSyncState: false,
          },
        ],
        toArchive: [],
        toHardDelete: [],
        toAdopt: [],
      },
      { id: "cal-1", user_id: "user-1" },
    );

    expect(failed.errors).toEqual(["Failed to update event-9: PostgrestError"]);
  });
});
