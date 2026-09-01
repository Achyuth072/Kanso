import { get, set } from "idb-keyval";
import type { Argon2Params } from "@/lib/crypto/masterKey";

export interface EncryptionKeyRow {
  user_id: string;
  passphrase_salt: string;
  passphrase_kdf_params: Argon2Params;
  wrapped_key_passphrase: string;
  recovery_salt: string;
  recovery_kdf_params: Argon2Params;
  wrapped_key_recovery: string;
}

const CACHE_KEY_PREFIX = "kagelin-encryption-key-row:";

// The wrapped key row is ciphertext — useless without the passphrase or
// recovery code — so caching it locally allows offline unlock to rederive
// the master key without a network round trip.
export const encryptionKeyRowCache = {
  async load(userId: string): Promise<EncryptionKeyRow | null> {
    const value = await get<EncryptionKeyRow>(CACHE_KEY_PREFIX + userId);
    return value ?? null;
  },
  async save(userId: string, row: EncryptionKeyRow): Promise<void> {
    await set(CACHE_KEY_PREFIX + userId, row);
  },
};
