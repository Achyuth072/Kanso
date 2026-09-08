import { MIN_PASSPHRASE_LENGTH } from "@/lib/crypto/passphraseStrength";
export function PassphraseStrengthHints({
  passphrase,
  tooShort,
  weak,
}: {
  passphrase: string;
  tooShort: boolean;
  weak: boolean;
}) {
  return (
    <>
      {tooShort && passphrase.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Use at least {MIN_PASSPHRASE_LENGTH} characters.
        </p>
      )}
      {!tooShort && weak && (
        <p className="text-xs text-foreground">
          This passphrase is easy to guess. You can still use it, but a longer,
          more varied one is safer.
        </p>
      )}
    </>
  );
}
