import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";
import { collectCloudBackup } from "@/lib/backup/cloud-data";
import { createBackupZip, parseBackupZip } from "@/lib/backup/export-import";

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

beforeEach(() => {
  keyStoreState.key = null;
});

describe("Backup export from an encrypted account", () => {
  it("contains readable data, not the account's ciphertext", async () => {
    const backend = createFakeSupabaseClient();
    const wrapped = wrapSupabaseClient(backend, FIELD_MAP);
    keyStoreState.key = await generateMasterKey();

    await wrapped
      .from("tasks")
      .insert({ id: "t1", user_id: "u1", content: "Plan the escape hatch" });
    await wrapped
      .from("habits")
      .insert({ id: "h1", user_id: "u1", name: "Ship encryption" });

    expect(isCiphertext(backend.rawRows("tasks")[0].content)).toBe(true);
    expect(isCiphertext(backend.rawRows("habits")[0].name)).toBe(true);

    const backup = await collectCloudBackup(wrapped);
    expect(backup.tasks[0].content).toBe("Plan the escape hatch");
    expect(backup.habits[0].name).toBe("Ship encryption");

    const zip = await createBackupZip(backup);
    const roundTripped = await parseBackupZip(zip);
    expect(roundTripped.tasks[0].content).toBe("Plan the escape hatch");
    expect(isCiphertext(roundTripped.tasks[0].content)).toBe(false);
  });

  it("imports into a different account, re-encrypted under that account's own key", async () => {
    const backendA = createFakeSupabaseClient();
    const wrappedA = wrapSupabaseClient(backendA, FIELD_MAP);
    keyStoreState.key = await generateMasterKey();

    await wrappedA.from("tasks").insert({
      id: "t1",
      user_id: "account-a",
      content: "Cross-account task",
    });

    const backup = await collectCloudBackup(wrappedA);
    const zip = await createBackupZip(backup);
    const imported = await parseBackupZip(zip);

    const backendB = createFakeSupabaseClient();
    const wrappedB = wrapSupabaseClient(backendB, FIELD_MAP);
    keyStoreState.key = await generateMasterKey();

    await wrappedB.from("tasks").insert({
      ...imported.tasks[0],
      id: "t1-remapped",
      user_id: "account-b",
    });

    expect(isCiphertext(backendB.rawRows("tasks")[0].content)).toBe(true);
    expect(backendB.rawRows("tasks")[0].content).not.toBe(
      backendA.rawRows("tasks")[0].content,
    );

    const { data } = await wrappedB
      .from("tasks")
      .select()
      .eq("id", "t1-remapped")
      .single();
    expect(data.content).toBe("Cross-account task");
  });
});
