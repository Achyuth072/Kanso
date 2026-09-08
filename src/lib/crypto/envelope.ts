import { getSodium } from "@/lib/crypto/sodium";

// Must match the scheme literal in supabase/schema.sql (encrypted_notification_body).
export const SCHEME = "xchacha20poly1305-v1";

// Reserved for key rotation.
export const CURRENT_KEY_ID = "1";

// Copies input into the current realm to satisfy libsodium's instanceof check across realms (e.g. jsdom).
export function toUint8Array(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input);
}

export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(toUint8Array(bytes), sodium.base64_variants.ORIGINAL);
}

export async function base64ToBytes(base64: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

export function isEnvelope(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${SCHEME}:`);
}

export async function sealEnvelope(
  key: Uint8Array,
  plaintext: Uint8Array,
  keyId: string = CURRENT_KEY_ID,
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
  const nonceB64 = await bytesToBase64(nonce);
  const ciphertextB64 = await bytesToBase64(ciphertext);
  return `${SCHEME}:${keyId}:${nonceB64}:${ciphertextB64}`;
}

export async function openEnvelope(
  key: Uint8Array,
  envelope: string,
): Promise<Uint8Array> {
  const [scheme, keyId, nonceB64, ciphertextB64] = envelope.split(":");
  if (scheme !== SCHEME || !keyId || !nonceB64 || !ciphertextB64) {
    throw new Error("Unrecognized ciphertext envelope");
  }

  const sodium = await getSodium();
  const nonce = await base64ToBytes(nonceB64);
  const ciphertext = await base64ToBytes(ciphertextB64);

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      toUint8Array(ciphertext),
      null,
      toUint8Array(nonce),
      toUint8Array(key),
    );
  } catch {
    throw new Error("Decryption failed: wrong key or corrupted ciphertext");
  }
}
