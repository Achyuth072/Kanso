import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = new Map<string, Row>();
let lastUpdatePayload: Row | null = null;
let offline = false;

function createEncryptionKeysTable() {
  return {
    select: () => ({
      eq: (_col: string, userId: string) => ({
        maybeSingle: async () => {
          if (offline) throw new Error("Failed to fetch");
          return { data: rows.get(userId) ?? null, error: null };
        },
      }),
    }),
    insert: async (payload: Row) => {
      rows.set(payload.user_id, { ...payload });
      return { error: null };
    },
    update: (payload: Row) => ({
      eq: async (_col: string, userId: string) => {
        lastUpdatePayload = payload;
        rows.set(userId, { ...rows.get(userId), ...payload });
        return { error: null };
      },
    }),
  };
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table !== "encryption_keys")
      throw new Error(`Unexpected table: ${table}`);
    return createEncryptionKeysTable();
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async (k: Uint8Array) => {
      keyStoreState.key = k;
    }),
    clear: vi.fn(async () => {
      keyStoreState.key = null;
    }),
  },
}));

const rowCache = new Map<string, Row>();
vi.mock("@/lib/crypto/encryptionKeyRowCache", () => ({
  encryptionKeyRowCache: {
    load: vi.fn(async (userId: string) => rowCache.get(userId) ?? null),
    save: vi.fn(async (userId: string, row: Row) => {
      rowCache.set(userId, row);
    }),
  },
}));

import {
  setupEncryption,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
  changePassphrase,
  reissueRecoveryCode,
  hasEncryptionKey,
  getEncryptionKeyRow,
  markMigrationComplete,
  UnlockError,
} from "@/lib/crypto/keyManager";

const USER_ID = "user-1";

describe("keyManager", () => {
  beforeEach(() => {
    rows.clear();
    rowCache.clear();
    lastUpdatePayload = null;
    keyStoreState.key = null;
    offline = false;
    vi.clearAllMocks();
  });

  it("setupEncryption is unlockable by both the passphrase and the recovery code it issues", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "first passphrase");
    expect(await hasEncryptionKey(USER_ID)).toBe(true);

    const byPassphrase = await unlockWithPassphrase(
      USER_ID,
      "first passphrase",
    );
    const byRecovery = await unlockWithRecoveryCode(USER_ID, recoveryCode);

    expect(byPassphrase).toEqual(byRecovery);
  }, 20000);

  it("rejects the wrong passphrase", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await expect(
      unlockWithPassphrase(USER_ID, "wrong passphrase"),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("rejects the wrong recovery code", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await expect(
      unlockWithRecoveryCode(
        USER_ID,
        "0000-0000-0000-0000-0000-0000-0000-0000",
      ),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("rejects unlocking an account with no key set up", async () => {
    await expect(unlockWithPassphrase(USER_ID, "anything")).rejects.toThrow(
      UnlockError,
    );
  });

  it("changePassphrase rewraps only the passphrase columns, leaving the recovery wrap byte-identical", async () => {
    const { recoveryCode } = await setupEncryption(USER_ID, "old passphrase");
    const before = { ...rows.get(USER_ID) };

    await changePassphrase(USER_ID, "old passphrase", "new passphrase");

    const after = rows.get(USER_ID)!;
    expect(after.recovery_salt).toBe(before.recovery_salt);
    expect(after.wrapped_key_recovery).toBe(before.wrapped_key_recovery);
    expect(after.recovery_kdf_params).toEqual(before.recovery_kdf_params);
    expect(after.passphrase_salt).not.toBe(before.passphrase_salt);
    expect(after.wrapped_key_passphrase).not.toBe(
      before.wrapped_key_passphrase,
    );

    expect(lastUpdatePayload).not.toHaveProperty("wrapped_key_recovery");
    expect(lastUpdatePayload).not.toHaveProperty("recovery_salt");

    await expect(
      unlockWithPassphrase(USER_ID, "old passphrase"),
    ).rejects.toThrow(UnlockError);
    const byNewPassphrase = await unlockWithPassphrase(
      USER_ID,
      "new passphrase",
    );
    const byRecovery = await unlockWithRecoveryCode(USER_ID, recoveryCode);
    expect(byNewPassphrase).toEqual(byRecovery);
  }, 20000);

  it("changePassphrase leaves the row untouched when the current passphrase is wrong", async () => {
    await setupEncryption(USER_ID, "old passphrase");
    const before = { ...rows.get(USER_ID) };

    await expect(
      changePassphrase(USER_ID, "wrong passphrase", "new passphrase"),
    ).rejects.toThrow(UnlockError);

    expect(rows.get(USER_ID)).toEqual(before);
  }, 20000);

  it("reissueRecoveryCode rewraps only the recovery columns, leaving the passphrase wrap byte-identical", async () => {
    await setupEncryption(USER_ID, "my passphrase");
    const before = { ...rows.get(USER_ID) };

    const newCode = await reissueRecoveryCode(USER_ID);

    const after = rows.get(USER_ID)!;
    expect(after.passphrase_salt).toBe(before.passphrase_salt);
    expect(after.wrapped_key_passphrase).toBe(before.wrapped_key_passphrase);
    expect(after.recovery_salt).not.toBe(before.recovery_salt);
    expect(after.wrapped_key_recovery).not.toBe(before.wrapped_key_recovery);

    const byPassphrase = await unlockWithPassphrase(USER_ID, "my passphrase");
    const byNewRecovery = await unlockWithRecoveryCode(USER_ID, newCode);
    expect(byPassphrase).toEqual(byNewRecovery);
  }, 20000);

  it("reissueRecoveryCode requires an unlocked device", async () => {
    await setupEncryption(USER_ID, "my passphrase");
    keyStoreState.key = null;

    await expect(reissueRecoveryCode(USER_ID)).rejects.toThrow(UnlockError);
  }, 20000);

  it("unlocks offline using the wrapped key row cached from an earlier online fetch — CONTEXT.md requires this", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    keyStoreState.key = null;

    offline = true;
    const masterKey = await unlockWithPassphrase(USER_ID, "first passphrase");

    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("still rejects a wrong passphrase offline, using the cached row", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    keyStoreState.key = null;

    offline = true;
    await expect(
      unlockWithPassphrase(USER_ID, "wrong passphrase"),
    ).rejects.toThrow(UnlockError);
  }, 20000);

  it("throws the underlying error when offline with nothing cached yet", async () => {
    offline = true;
    await expect(unlockWithPassphrase(USER_ID, "anything")).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("changePassphrase refreshes the offline cache, so a later offline unlock sees the new passphrase, not the old one", async () => {
    await setupEncryption(USER_ID, "old passphrase");
    await hasEncryptionKey(USER_ID);
    await changePassphrase(USER_ID, "old passphrase", "new passphrase");
    keyStoreState.key = null;

    offline = true;
    await expect(
      unlockWithPassphrase(USER_ID, "old passphrase"),
    ).rejects.toThrow(UnlockError);
    const masterKey = await unlockWithPassphrase(USER_ID, "new passphrase");
    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("reissueRecoveryCode refreshes the offline cache, so a later offline unlock sees the new code, not the invalidated one", async () => {
    const { recoveryCode: oldCode } = await setupEncryption(
      USER_ID,
      "my passphrase",
    );
    await hasEncryptionKey(USER_ID);
    const newCode = await reissueRecoveryCode(USER_ID);

    offline = true;
    await expect(unlockWithRecoveryCode(USER_ID, oldCode)).rejects.toThrow(
      UnlockError,
    );
    const masterKey = await unlockWithRecoveryCode(USER_ID, newCode);
    expect(masterKey).toBeInstanceOf(Uint8Array);
  }, 20000);

  it("getEncryptionKeyRow reports migrated_at as null until markMigrationComplete runs", async () => {
    await setupEncryption(USER_ID, "first passphrase");

    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toBeFalsy();

    await markMigrationComplete(USER_ID);

    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toEqual(
      expect.any(String),
    );
  }, 20000);

  it("markMigrationComplete refreshes the offline cache, so a later offline check sees migration as done", async () => {
    await setupEncryption(USER_ID, "first passphrase");
    await hasEncryptionKey(USER_ID);
    await markMigrationComplete(USER_ID);

    offline = true;
    expect((await getEncryptionKeyRow(USER_ID))?.migrated_at).toEqual(
      expect.any(String),
    );
  }, 20000);
});
