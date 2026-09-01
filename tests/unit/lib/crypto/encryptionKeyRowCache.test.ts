import { describe, it, expect, vi, beforeEach } from "vitest";

const idbStore = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => idbStore.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    idbStore.delete(key);
  }),
}));

import {
  encryptionKeyRowCache,
  type EncryptionKeyRow,
} from "@/lib/crypto/encryptionKeyRowCache";

const row: EncryptionKeyRow = {
  user_id: "user-1",
  passphrase_salt: "salt",
  passphrase_kdf_params: { m: 1, t: 1, p: 1 },
  wrapped_key_passphrase: "wrapped",
  recovery_salt: "recovery-salt",
  recovery_kdf_params: { m: 1, t: 1, p: 1 },
  wrapped_key_recovery: "wrapped-recovery",
};

describe("encryptionKeyRowCache", () => {
  beforeEach(() => {
    idbStore.clear();
  });

  it("returns null when nothing has been cached for the user", async () => {
    expect(await encryptionKeyRowCache.load("user-1")).toBeNull();
  });

  it("round-trips a saved row through load", async () => {
    await encryptionKeyRowCache.save("user-1", row);
    expect(await encryptionKeyRowCache.load("user-1")).toEqual(row);
  });

  it("keys the cache per user, so one user's row never answers for another's", async () => {
    await encryptionKeyRowCache.save("user-1", row);
    expect(await encryptionKeyRowCache.load("user-2")).toBeNull();
  });
});
