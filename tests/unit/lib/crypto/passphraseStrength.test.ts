import { describe, it, expect } from "vitest";
import {
  checkPassphraseStrength,
  MIN_PASSPHRASE_LENGTH,
} from "@/lib/crypto/passphraseStrength";

describe("checkPassphraseStrength", () => {
  it("flags a passphrase shorter than the minimum as too short and weak", () => {
    const result = checkPassphraseStrength(
      "a".repeat(MIN_PASSPHRASE_LENGTH - 1),
    );
    expect(result.tooShort).toBe(true);
    expect(result.weak).toBe(true);
  });

  it("flags a long but low-variety passphrase as weak", () => {
    const result = checkPassphraseStrength("aaaaaaaaaaaaaaaa");
    expect(result.tooShort).toBe(false);
    expect(result.weak).toBe(true);
  });

  it("flags a known common passphrase as weak regardless of case", () => {
    const result = checkPassphraseStrength("CorrectHorseBatteryStaple");
    expect(result.weak).toBe(true);
  });

  it("accepts a sufficiently long, varied passphrase", () => {
    const result = checkPassphraseStrength("Quixotic!Marmoset42Wanders");
    expect(result.tooShort).toBe(false);
    expect(result.weak).toBe(false);
  });
});
