import { describe, it, expect } from "vitest";
import { getSodium } from "@/lib/crypto/sodium";
import {
  SCHEME,
  CURRENT_KEY_ID,
  isEnvelope,
  sealEnvelope,
  openEnvelope,
} from "@/lib/crypto/envelope";

async function generateKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(32);
}

describe("sealEnvelope / openEnvelope", () => {
  it("round-trips arbitrary bytes", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("hello, world");

    const envelope = await sealEnvelope(key, plaintext);
    const decrypted = await openEnvelope(key, envelope);

    expect(new TextDecoder().decode(decrypted)).toBe("hello, world");
  });

  it("stamps the current scheme and key id by default", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));
    const [scheme, keyId] = envelope.split(":");
    expect(scheme).toBe(SCHEME);
    expect(keyId).toBe(CURRENT_KEY_ID);
  });

  it("accepts an explicit key id for rotation", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(
      key,
      new TextEncoder().encode("x"),
      "2",
    );
    expect(envelope.split(":")[1]).toBe("2");
  });

  it("rejects decryption with the wrong key", async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const envelope = await sealEnvelope(
      key,
      new TextEncoder().encode("secret"),
    );

    await expect(openEnvelope(wrongKey, envelope)).rejects.toThrow();
  });

  it("rejects an envelope with an unrecognized scheme", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));
    const tampered = envelope.replace(SCHEME, "some-other-scheme");

    await expect(openEnvelope(key, tampered)).rejects.toThrow(
      "Unrecognized ciphertext envelope",
    );
  });
});

describe("isEnvelope", () => {
  it("recognizes a sealed envelope and rejects plaintext", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));

    expect(isEnvelope(envelope)).toBe(true);
    expect(isEnvelope("plain text")).toBe(false);
    expect(isEnvelope(null)).toBe(false);
  });
});
