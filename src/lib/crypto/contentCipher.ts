import { getSodium } from "@/lib/crypto/sodium";
import { bytesToBase64, base64ToBytes } from "@/lib/crypto/masterKey";

/**
 * Encrypts column values for the wrapped Supabase client.
 * Envelope: `<scheme>:<keyId>:<nonce>:<ciphertext>` (base64-encoded).
 * `keyId` is reserved for key rotation.
 */
const SCHEME = "xchacha20poly1305-v1";
const KEY_ID = "1";

// Copies input into current realm to satisfy libsodium instanceof checks across realms (e.g. jsdom).
function toUint8Array(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input);
}

export function isCiphertext(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${SCHEME}:`);
}

export async function encryptField(
  key: Uint8Array,
  plaintext: string,
): Promise<string> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    toUint8Array(sodium.from_string(plaintext)),
    null,
    null,
    nonce,
    toUint8Array(key),
  );
  const nonceB64 = await bytesToBase64(nonce);
  const ciphertextB64 = await bytesToBase64(ciphertext);
  return `${SCHEME}:${KEY_ID}:${nonceB64}:${ciphertextB64}`;
}

export async function decryptField(
  key: Uint8Array,
  envelope: string,
): Promise<string> {
  const [scheme, keyId, nonceB64, ciphertextB64] = envelope.split(":");
  if (scheme !== SCHEME || !keyId || !nonceB64 || !ciphertextB64) {
    throw new Error("Unrecognized ciphertext envelope");
  }

  const sodium = await getSodium();
  const nonce = await base64ToBytes(nonceB64);
  const ciphertext = await base64ToBytes(ciphertextB64);

  try {
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      toUint8Array(ciphertext),
      null,
      toUint8Array(nonce),
      toUint8Array(key),
    );
    return sodium.to_string(plaintext);
  } catch {
    throw new Error("Decryption failed: wrong key or corrupted ciphertext");
  }
}
