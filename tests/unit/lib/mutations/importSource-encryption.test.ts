import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

const backend = { raw: createFakeSupabaseClient() };
function withAuth(client: ReturnType<typeof createFakeSupabaseClient>) {
  client.auth = {
    getSession: async () => ({ data: { session: { user: { id: "user-1" } } } }),
  };
  return client;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => wrapSupabaseClient(withAuth(backend.raw), FIELD_MAP),
}));

const { persistImportSource } = await import("@/lib/mutations/importSource");

const raw = {
  habits: [{ id: 1, name: "Meditate", question: "Did you sit today?" }],
  repetitions: [{ habit: 1, timestamp: 1750000000000, value: 2 }],
};

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  backend.raw = createFakeSupabaseClient();
});

describe("uhabits import provenance through the encrypting client", () => {
  it("stores the raw blob and file name as ciphertext, and reads them back verbatim", async () => {
    await persistImportSource(
      {
        source_app: "uhabits",
        file_name: "Loop Habits Backup 2026-07-16.db",
        raw,
      },
      { isGuest: false },
    );

    const stored = backend.raw.rawRows("habit_imports")[0];
    expect(isCiphertext(stored.raw)).toBe(true);
    expect(isCiphertext(stored.file_name)).toBe(true);
    expect(stored.source_app).toBe("uhabits");
    expect(JSON.stringify(stored)).not.toContain("Meditate");

    const client = wrapSupabaseClient(backend.raw, FIELD_MAP);
    const { data } = await client
      .from("habit_imports")
      .select()
      .eq("user_id", "user-1")
      .single();

    expect(data.raw).toEqual(raw);
    expect(data.file_name).toBe("Loop Habits Backup 2026-07-16.db");
  });

  it("stores a null file name as null rather than ciphertext", async () => {
    await persistImportSource(
      { source_app: "uhabits", file_name: null, raw },
      { isGuest: false },
    );

    expect(backend.raw.rawRows("habit_imports")[0].file_name).toBeNull();
  });
});
