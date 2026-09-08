import { describe, it, expect } from "vitest";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import {
  encryptField,
  decryptField,
  isCiphertext,
} from "@/lib/crypto/contentCipher";

describe("encryptField / decryptField", () => {
  it("round-trips a plaintext string", async () => {
    const key = await generateMasterKey();
    const envelope = await encryptField(key, "Buy milk");
    expect(await decryptField(key, envelope)).toBe("Buy milk");
  });

  it("produces an envelope carrying a scheme and key identifier", async () => {
    const key = await generateMasterKey();
    const envelope = await encryptField(key, "hello");
    const parts = envelope.split(":");
    expect(parts).toHaveLength(4);
    const [scheme, keyId, nonce, ciphertext] = parts;
    expect(scheme).toBe("xchacha20poly1305-v1");
    expect(keyId).toBeTruthy();
    expect(nonce).toBeTruthy();
    expect(ciphertext).toBeTruthy();
  });

  it("produces a different envelope each time (random nonce)", async () => {
    const key = await generateMasterKey();
    const a = await encryptField(key, "same content");
    const b = await encryptField(key, "same content");
    expect(a).not.toBe(b);
    expect(await decryptField(key, a)).toBe("same content");
    expect(await decryptField(key, b)).toBe("same content");
  });

  it("rejects decryption with the wrong key", async () => {
    const key = await generateMasterKey();
    const wrongKey = await generateMasterKey();
    const envelope = await encryptField(key, "secret");
    await expect(decryptField(wrongKey, envelope)).rejects.toThrow();
  });

  it("rejects a tampered ciphertext", async () => {
    const key = await generateMasterKey();
    const envelope = await encryptField(key, "secret");
    const [scheme, keyId, nonce, ciphertext] = envelope.split(":");
    const tampered = `${scheme}:${keyId}:${nonce}:${ciphertext.slice(0, -4)}AAAA`;
    await expect(decryptField(key, tampered)).rejects.toThrow();
  });

  it("rejects an envelope with an unrecognized scheme", async () => {
    const key = await generateMasterKey();
    await expect(
      decryptField(key, "some-other-scheme:1:nonce:ciphertext"),
    ).rejects.toThrow("Unrecognized ciphertext envelope");
  });
});

describe("isCiphertext", () => {
  it("recognizes a tagged envelope", async () => {
    const key = await generateMasterKey();
    const envelope = await encryptField(key, "hello");
    expect(isCiphertext(envelope)).toBe(true);
  });

  it("treats untagged plaintext as not-ciphertext", () => {
    expect(isCiphertext("just a plain string")).toBe(false);
    expect(isCiphertext("")).toBe(false);
  });

  it("treats non-strings as not-ciphertext", () => {
    expect(isCiphertext(null)).toBe(false);
    expect(isCiphertext(undefined)).toBe(false);
    expect(isCiphertext(42)).toBe(false);
    expect(isCiphertext({})).toBe(false);
  });
});
