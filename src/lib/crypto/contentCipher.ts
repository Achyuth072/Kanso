import { getSodium } from "@/lib/crypto/sodium";
import { sealEnvelope, openEnvelope, isEnvelope } from "@/lib/crypto/envelope";

export const isCiphertext = isEnvelope;

export async function encryptField(
  key: Uint8Array,
  plaintext: string,
): Promise<string> {
  const sodium = await getSodium();
  return sealEnvelope(key, sodium.from_string(plaintext));
}

export async function decryptField(
  key: Uint8Array,
  envelope: string,
): Promise<string> {
  const sodium = await getSodium();
  const plaintext = await openEnvelope(key, envelope);
  return sodium.to_string(plaintext);
}
