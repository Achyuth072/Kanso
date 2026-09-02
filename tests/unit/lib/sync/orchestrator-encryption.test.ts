import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { CalendarEvent } from "@/lib/types/calendar-event";
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

// The orchestrator resolves its client per call, so the wrapped fake stands in
// for the real browser client and the sync path runs unmodified.
const backend = { raw: createFakeSupabaseClient() };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => wrapSupabaseClient(backend.raw, FIELD_MAP),
}));

const { applyPullMutations } = await import("@/lib/sync/orchestrator");

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  backend.raw = createFakeSupabaseClient();
});

const calendar = { id: "cal-1", user_id: "user-1" };

describe("on-demand calendar sync through the encrypting client", () => {
  it("stores pulled events as ciphertext and hands them back as plaintext", async () => {
    const metadata = { attendees: ["ada@example.com"], organizer: "grace" };

    const result = await applyPullMutations(
      {
        toCreate: [
          {
            title: "Oncology follow-up",
            description: "Bring scan results",
            location: "St Mary's, room 4",
            start_time: "2026-09-03T09:00:00Z",
            end_time: "2026-09-03T10:00:00Z",
            all_day: false,
            recurrence_rule: "FREQ=WEEKLY",
            metadata,
            remote_id: "google-event-1",
            etag: "etag-1",
          },
        ],
        toUpdate: [],
        toArchive: [],
        toHardDelete: [],
        toAdopt: [],
      },
      calendar,
    );

    expect(result.errors).toEqual([]);
    expect(result.created).toBe(1);

    const stored = backend.raw.rawRows("calendar_events")[0];
    expect(isCiphertext(stored.title)).toBe(true);
    expect(isCiphertext(stored.description)).toBe(true);
    expect(isCiphertext(stored.location)).toBe(true);
    expect(isCiphertext(stored.metadata)).toBe(true);
    // Sync itself depends on these, so they must stay readable.
    expect(stored.remote_id).toBe("google-event-1");
    expect(stored.etag).toBe("etag-1");
    expect(stored.start_time).toBe("2026-09-03T09:00:00Z");
    expect(stored.recurrence_rule).toBe("FREQ=WEEKLY");

    // The next sync re-reads local events to diff against the remote.
    const client = wrapSupabaseClient(backend.raw, FIELD_MAP);
    const locals = await fetchAllRows<CalendarEvent>((from, to) =>
      client
        .from("calendar_events")
        .select("*")
        .eq("remote_calendar_id", calendar.id)
        .order("id", { ascending: true })
        .range(from, to),
    );
    expect(locals).toHaveLength(1);
    expect(locals[0].title).toBe("Oncology follow-up");
    expect(locals[0].metadata).toEqual(metadata);
  });

  it("re-encrypts on update and still matches the row by its readable remote_id", async () => {
    await applyPullMutations(
      {
        toCreate: [
          {
            title: "Standup",
            start_time: "2026-09-03T09:00:00Z",
            end_time: "2026-09-03T09:15:00Z",
            remote_id: "google-event-1",
            etag: "etag-1",
          },
        ],
        toUpdate: [],
        toArchive: [],
        toHardDelete: [],
        toAdopt: [],
      },
      calendar,
    );
    const created = backend.raw.rawRows("calendar_events")[0] as Row;

    const result = await applyPullMutations(
      {
        toCreate: [],
        toUpdate: [
          {
            id: created.id,
            data: {
              title: "Standup — moved",
              start_time: "2026-09-03T10:00:00Z",
              end_time: "2026-09-03T10:15:00Z",
              metadata: { conference_url: "https://meet.example.com/xyz" },
            },
            etag: "etag-2",
            clearSyncState: true,
          },
        ],
        toArchive: [],
        toHardDelete: [],
        toAdopt: [],
      },
      calendar,
    );

    expect(result.errors).toEqual([]);
    const stored = backend.raw.rawRows("calendar_events")[0];
    expect(isCiphertext(stored.title)).toBe(true);
    expect(isCiphertext(stored.metadata)).toBe(true);
    expect(stored.etag).toBe("etag-2");
    expect(stored.sync_state).toBeNull();

    const client = wrapSupabaseClient(backend.raw, FIELD_MAP);
    const { data } = await client
      .from("calendar_events")
      .select()
      .eq("id", created.id)
      .single();
    expect(data.title).toBe("Standup — moved");
    expect(data.metadata).toEqual({
      conference_url: "https://meet.example.com/xyz",
    });
  });
});
