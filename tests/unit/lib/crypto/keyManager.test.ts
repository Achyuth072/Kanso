import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = new Map<string, Row>();
let lastUpdatePayload: Row | null = null;

function createEncryptionKeysTable() {
  return {
    select: () => ({
      eq: (_col: string, userId: string) => ({
        maybeSingle: async () => ({
          data: rows.get(userId) ?? null,
          error: null,
        }),
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

import {
  setupEncryption,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
  changePassphrase,
  reissueRecoveryCode,
  hasEncryptionKey,
  UnlockError,
} from "@/lib/crypto/keyManager";

const USER_ID = "user-1";

describe("keyManager", () => {
  beforeEach(() => {
    rows.clear();
    lastUpdatePayload = null;
    keyStoreState.key = null;
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

    // The update call itself never even mentions the recovery columns.
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
});
