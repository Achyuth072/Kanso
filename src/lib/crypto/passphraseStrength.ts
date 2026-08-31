export const MIN_PASSPHRASE_LENGTH = 10;

const COMMON_WEAK_PASSPHRASES = new Set([
  "password",
  "passphrase",
  "letmeinletmein",
  "qwertyqwerty",
  "1234567890",
  "12345678901",
  "iloveyouiloveyou",
  "correcthorsebatterystaple",
  "welcometokagelin",
  "changemechangeme",
]);

export interface PassphraseStrength {
  tooShort: boolean;
  weak: boolean;
}

export function checkPassphraseStrength(
  passphrase: string,
): PassphraseStrength {
  const tooShort = passphrase.length < MIN_PASSPHRASE_LENGTH;
  const isCommon = COMMON_WEAK_PASSPHRASES.has(passphrase.toLowerCase().trim());
  const lowVariety = new Set(passphrase).size < 4;

  return { tooShort, weak: tooShort || isCommon || lowVariety };
}
