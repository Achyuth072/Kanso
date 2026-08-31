import { getSodium } from "@/lib/crypto/sodium";

// Copies input into the current realm to satisfy libsodium's instanceof check across realms (e.g. jsdom).
function toUint8Array(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input);
}

// Argon2id parameters stored alongside the salt to allow future upgrades.
export interface Argon2Params {
  m: number;
  t: number;
  p: number;
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  m: 64 * 1024 * 1024,
  t: 3,
  p: 1,
};

export const MASTER_KEY_BYTES = 32;

const CONTENT_SCHEME = "xchacha20poly1305-v1";

export async function generateMasterKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(MASTER_KEY_BYTES);
}

export async function generateSalt(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(toUint8Array(bytes), sodium.base64_variants.ORIGINAL);
}

export async function base64ToBytes(base64: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

// NFKC normalization ensures identical passphrases from different keyboards/OSes derive the same key.
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_pwhash(
    MASTER_KEY_BYTES,
    passphrase.normalize("NFKC"),
    toUint8Array(salt),
    params.t,
    params.m,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export async function encrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<string> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    toUint8Array(plaintext),
    null,
    null,
    nonce,
    toUint8Array(key),
  );
  const nonceB64 = sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL);
  const ciphertextB64 = sodium.to_base64(
    ciphertext,
    sodium.base64_variants.ORIGINAL,
  );
  return `${CONTENT_SCHEME}:${nonceB64}:${ciphertextB64}`;
}

export async function decrypt(
  key: Uint8Array,
  envelope: string,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const [scheme, nonceB64, ciphertextB64] = envelope.split(":");
  if (scheme !== CONTENT_SCHEME || !nonceB64 || !ciphertextB64) {
    throw new Error("Unrecognized ciphertext envelope");
  }

  const nonce = sodium.from_base64(nonceB64, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(
    ciphertextB64,
    sodium.base64_variants.ORIGINAL,
  );

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      toUint8Array(key),
    );
  } catch {
    throw new Error("Decryption failed: wrong key or corrupted ciphertext");
  }
}

export async function wrapMasterKey(
  masterKey: Uint8Array,
  derivedKey: Uint8Array,
): Promise<string> {
  return encrypt(derivedKey, masterKey);
}

export async function unwrapMasterKey(
  wrapped: string,
  derivedKey: Uint8Array,
): Promise<Uint8Array> {
  return decrypt(derivedKey, wrapped);
}

// Crockford base32 excludes 0/O/1/I/L to avoid visual ambiguity.
const RECOVERY_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RECOVERY_CODE_BYTES = 20;
const RECOVERY_CODE_GROUP_SIZE = 4;

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += RECOVERY_CODE_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += RECOVERY_CODE_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function formatRecoveryCode(raw: string): string {
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += RECOVERY_CODE_GROUP_SIZE) {
    groups.push(raw.slice(i, i + RECOVERY_CODE_GROUP_SIZE));
  }
  return groups.join("-");
}

export interface RecoveryCode {
  raw: string;
  formatted: string;
}

export async function generateRecoveryCode(): Promise<RecoveryCode> {
  const sodium = await getSodium();
  const bytes = sodium.randombytes_buf(RECOVERY_CODE_BYTES);
  const raw = base32Encode(bytes);
  return { raw, formatted: formatRecoveryCode(raw) };
}

export function normalizeRecoveryCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}
