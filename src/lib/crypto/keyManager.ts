import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_ARGON2_PARAMS,
  base64ToBytes,
  bytesToBase64,
  deriveKeyFromPassphrase,
  generateMasterKey,
  generateRecoveryCode,
  generateSalt,
  normalizeRecoveryCode,
  unwrapMasterKey,
  wrapMasterKey,
} from "@/lib/crypto/masterKey";
import { keyStore } from "@/lib/crypto/keyStore";
import {
  encryptionKeyRowCache,
  type EncryptionKeyRow,
} from "@/lib/crypto/encryptionKeyRowCache";

export class UnlockError extends Error {}

async function fetchEncryptionKeyRow(
  userId: string,
): Promise<EncryptionKeyRow | null> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("encryption_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    const row = (data as EncryptionKeyRow | null) ?? null;
    if (row) await encryptionKeyRowCache.save(userId, row);
    return row;
  } catch (err) {
    // Unlocking (a Locked app, or a reload with no connectivity) must work
    // offline — fall back to whatever was cached on an earlier online fetch.
    const cached = await encryptionKeyRowCache.load(userId);
    if (cached) return cached;
    throw err;
  }
}

export async function hasEncryptionKey(userId: string): Promise<boolean> {
  return (await fetchEncryptionKeyRow(userId)) !== null;
}

export interface SetupEncryptionResult {
  recoveryCode: string;
}

export async function setupEncryption(
  userId: string,
  passphrase: string,
): Promise<SetupEncryptionResult> {
  const masterKey = await generateMasterKey();

  const passphraseSalt = await generateSalt();
  const passphraseKey = await deriveKeyFromPassphrase(
    passphrase,
    passphraseSalt,
  );
  const wrappedByPassphrase = await wrapMasterKey(masterKey, passphraseKey);

  const recoveryCode = await generateRecoveryCode();
  const recoverySalt = await generateSalt();
  const recoveryKey = await deriveKeyFromPassphrase(
    recoveryCode.raw,
    recoverySalt,
  );
  const wrappedByRecovery = await wrapMasterKey(masterKey, recoveryKey);

  const supabase = createClient();
  const { error } = await supabase.from("encryption_keys").insert({
    user_id: userId,
    passphrase_salt: await bytesToBase64(passphraseSalt),
    passphrase_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_passphrase: wrappedByPassphrase,
    recovery_salt: await bytesToBase64(recoverySalt),
    recovery_kdf_params: DEFAULT_ARGON2_PARAMS,
    wrapped_key_recovery: wrappedByRecovery,
  });
  if (error) throw error;

  await keyStore.save(masterKey);

  return { recoveryCode: recoveryCode.formatted };
}

export async function unlockWithPassphrase(
  userId: string,
  passphrase: string,
): Promise<Uint8Array> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const salt = await base64ToBytes(row.passphrase_salt);
  const derivedKey = await deriveKeyFromPassphrase(
    passphrase,
    salt,
    row.passphrase_kdf_params,
  );

  let masterKey: Uint8Array;
  try {
    masterKey = await unwrapMasterKey(row.wrapped_key_passphrase, derivedKey);
  } catch {
    throw new UnlockError("That passphrase isn't right.");
  }

  await keyStore.save(masterKey);
  return masterKey;
}

export async function unlockWithRecoveryCode(
  userId: string,
  recoveryCode: string,
): Promise<Uint8Array> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const salt = await base64ToBytes(row.recovery_salt);
  const derivedKey = await deriveKeyFromPassphrase(
    normalizeRecoveryCode(recoveryCode),
    salt,
    row.recovery_kdf_params,
  );

  let masterKey: Uint8Array;
  try {
    masterKey = await unwrapMasterKey(row.wrapped_key_recovery, derivedKey);
  } catch {
    throw new UnlockError("That recovery code isn't right.");
  }

  await keyStore.save(masterKey);
  return masterKey;
}

export async function changePassphrase(
  userId: string,
  currentPassphrase: string,
  newPassphrase: string,
): Promise<void> {
  const row = await fetchEncryptionKeyRow(userId);
  if (!row) {
    throw new UnlockError("Encryption isn't set up for this account yet.");
  }

  const currentSalt = await base64ToBytes(row.passphrase_salt);
  const currentDerivedKey = await deriveKeyFromPassphrase(
    currentPassphrase,
    currentSalt,
    row.passphrase_kdf_params,
  );

  let masterKey: Uint8Array;
  try {
    masterKey = await unwrapMasterKey(
      row.wrapped_key_passphrase,
      currentDerivedKey,
    );
  } catch {
    throw new UnlockError("That passphrase isn't right.");
  }

  const newSalt = await generateSalt();
  const newDerivedKey = await deriveKeyFromPassphrase(newPassphrase, newSalt);
  const newWrapped = await wrapMasterKey(masterKey, newDerivedKey);

  const supabase = createClient();
  const { error } = await supabase
    .from("encryption_keys")
    .update({
      passphrase_salt: await bytesToBase64(newSalt),
      passphrase_kdf_params: DEFAULT_ARGON2_PARAMS,
      wrapped_key_passphrase: newWrapped,
    })
    .eq("user_id", userId);
  if (error) throw error;

  // Re-fetch so the offline cache reflects the new wrap — otherwise a
  // subsequent offline unlock would fall back to the old passphrase's row.
  await fetchEncryptionKeyRow(userId);

  await keyStore.save(masterKey);
}

export async function reissueRecoveryCode(userId: string): Promise<string> {
  const masterKey = await keyStore.load();
  if (!masterKey) {
    throw new UnlockError("Unlock before generating a new recovery code.");
  }

  const recoveryCode = await generateRecoveryCode();
  const recoverySalt = await generateSalt();
  const recoveryKey = await deriveKeyFromPassphrase(
    recoveryCode.raw,
    recoverySalt,
  );
  const wrapped = await wrapMasterKey(masterKey, recoveryKey);

  const supabase = createClient();
  const { error } = await supabase
    .from("encryption_keys")
    .update({
      recovery_salt: await bytesToBase64(recoverySalt),
      recovery_kdf_params: DEFAULT_ARGON2_PARAMS,
      wrapped_key_recovery: wrapped,
    })
    .eq("user_id", userId);
  if (error) throw error;

  // Re-fetch so the offline cache reflects the new code — otherwise the
  // invalidated one would still unwrap the key while offline.
  await fetchEncryptionKeyRow(userId);

  return recoveryCode.formatted;
}
