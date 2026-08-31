import { describe, it, expect } from "vitest";
import {
  generateMasterKey,
  generateSalt,
  deriveKeyFromPassphrase,
  encrypt,
  decrypt,
  wrapMasterKey,
  unwrapMasterKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  MASTER_KEY_BYTES,
  DEFAULT_ARGON2_PARAMS,
} from "@/lib/crypto/masterKey";

describe("generateMasterKey", () => {
  it("returns 32 random bytes that differ across calls", async () => {
    const a = await generateMasterKey();
    const b = await generateMasterKey();
    expect(a).toHaveLength(MASTER_KEY_BYTES);
    expect(b).toHaveLength(MASTER_KEY_BYTES);
    expect(a).not.toEqual(b);
  });
});

describe("deriveKeyFromPassphrase", () => {
  it("is deterministic for the same passphrase, salt and params", async () => {
    const salt = await generateSalt();
    const a = await deriveKeyFromPassphrase("correct horse battery", salt);
    const b = await deriveKeyFromPassphrase("correct horse battery", salt);
    expect(a).toEqual(b);
    expect(a).toHaveLength(MASTER_KEY_BYTES);
  });

  it("derives a different key for a different passphrase", async () => {
    const salt = await generateSalt();
    const a = await deriveKeyFromPassphrase("correct horse battery", salt);
    const b = await deriveKeyFromPassphrase("wrong passphrase", salt);
    expect(a).not.toEqual(b);
  });

  it("derives a different key for a different salt", async () => {
    const saltA = await generateSalt();
    const saltB = await generateSalt();
    const a = await deriveKeyFromPassphrase("same passphrase", saltA);
    const b = await deriveKeyFromPassphrase("same passphrase", saltB);
    expect(a).not.toEqual(b);
  });
}, 20000);

describe("encrypt / decrypt", () => {
  it("round-trips arbitrary bytes", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("hello, world");

    const envelope = await encrypt(key, plaintext);
    const decrypted = await decrypt(key, envelope);

    expect(new TextDecoder().decode(decrypted)).toBe("hello, world");
  });

  it("produces a different envelope each call (random nonce)", async () => {
    const key = await generateMasterKey();
    const plaintext = new TextEncoder().encode("hello, world");

    const a = await encrypt(key, plaintext);
    const b = await encrypt(key, plaintext);

    expect(a).not.toBe(b);
  });

  it("rejects decryption with the wrong key", async () => {
    const key = await generateMasterKey();
    const wrongKey = await generateMasterKey();
    const envelope = await encrypt(key, new TextEncoder().encode("secret"));

    await expect(decrypt(wrongKey, envelope)).rejects.toThrow();
  });

  it("detects a tampered ciphertext", async () => {
    const key = await generateMasterKey();
    const envelope = await encrypt(key, new TextEncoder().encode("secret"));
    const [scheme, nonce, ciphertext] = envelope.split(":");
    const tamperedChar = ciphertext.at(-1) === "A" ? "B" : "A";
    const tampered = `${scheme}:${nonce}:${ciphertext.slice(0, -1)}${tamperedChar}`;

    await expect(decrypt(key, tampered)).rejects.toThrow();
  });
}, 20000);

describe("wrapMasterKey / unwrapMasterKey", () => {
  it("round-trips the master key under a passphrase-derived key", async () => {
    const masterKey = await generateMasterKey();
    const salt = await generateSalt();
    const derivedKey = await deriveKeyFromPassphrase("my passphrase", salt);

    const wrapped = await wrapMasterKey(masterKey, derivedKey);
    const unwrapped = await unwrapMasterKey(wrapped, derivedKey);

    expect(unwrapped).toEqual(masterKey);
  });

  it("rejects unwrapping with a key derived from the wrong passphrase", async () => {
    const masterKey = await generateMasterKey();
    const salt = await generateSalt();
    const derivedKey = await deriveKeyFromPassphrase(
      "correct passphrase",
      salt,
    );
    const wrongDerivedKey = await deriveKeyFromPassphrase(
      "wrong passphrase",
      salt,
    );

    const wrapped = await wrapMasterKey(masterKey, derivedKey);

    await expect(unwrapMasterKey(wrapped, wrongDerivedKey)).rejects.toThrow();
  });

  it("unwraps the same master key by either the passphrase or the recovery code wrapper", async () => {
    const masterKey = await generateMasterKey();

    const passphraseSalt = await generateSalt();
    const passphraseKey = await deriveKeyFromPassphrase(
      "my passphrase",
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

    const unwrappedByPassphrase = await unwrapMasterKey(
      wrappedByPassphrase,
      passphraseKey,
    );
    const unwrappedByRecovery = await unwrapMasterKey(
      wrappedByRecovery,
      recoveryKey,
    );

    expect(unwrappedByPassphrase).toEqual(masterKey);
    expect(unwrappedByRecovery).toEqual(masterKey);
  });
}, 20000);

describe("generateRecoveryCode / normalizeRecoveryCode", () => {
  it("generates a code in grouped, uppercase, unambiguous form", async () => {
    const code = await generateRecoveryCode();
    expect(code.formatted).toMatch(
      /^([0-9A-HJ-KM-NP-TV-Z]{4}-){7}[0-9A-HJ-KM-NP-TV-Z]{4}$/,
    );
    expect(code.raw).toBe(code.formatted.replace(/-/g, ""));
  });

  it("generates a different code on each call", async () => {
    const a = await generateRecoveryCode();
    const b = await generateRecoveryCode();
    expect(a.raw).not.toBe(b.raw);
  });

  it("normalizes whitespace, dashes and case back to the canonical form", async () => {
    const code = await generateRecoveryCode();
    const messy = `  ${code.formatted.toLowerCase()}  `;
    expect(normalizeRecoveryCode(messy)).toBe(code.raw);
  });
});

describe("DEFAULT_ARGON2_PARAMS", () => {
  it("starts at m=64MB, t=3, p=1", () => {
    expect(DEFAULT_ARGON2_PARAMS).toEqual({
      m: 64 * 1024 * 1024,
      t: 3,
      p: 1,
    });
  });
});
