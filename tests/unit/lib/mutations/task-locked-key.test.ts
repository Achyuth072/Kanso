import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
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

const { taskMutations } = await import("@/lib/mutations/task");

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  backend.raw = createFakeSupabaseClient();
});

describe("taskMutations.create with a locked content key", () => {
  it("throws content_key_unavailable rather than writing plaintext", async () => {
    keyStoreState.key = null;

    await expect(
      taskMutations.create({ content: "Buy milk" }),
    ).rejects.toMatchObject({ code: "content_key_unavailable" });

    expect(backend.raw.rawRows("tasks")).toHaveLength(0);
  });
});
