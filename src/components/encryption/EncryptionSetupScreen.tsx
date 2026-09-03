"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { Button } from "@/components/ui/button";
import { setupEncryption } from "@/lib/crypto/keyManager";
import { checkPassphraseStrength } from "@/lib/crypto/passphraseStrength";
import { RecoveryCodeDisplay } from "@/components/encryption/RecoveryCodeDisplay";
import { PassphraseStrengthHints } from "@/components/encryption/PassphraseStrengthHints";

function PassphraseStep({
  userId,
  onSetupComplete,
}: {
  userId: string;
  onSetupComplete: (recoveryCode: string) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { tooShort, weak } = checkPassphraseStrength(passphrase);
  const mismatch = confirmPassphrase !== passphrase;
  const showMismatch = confirmPassphrase.length > 0 && mismatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || tooShort || mismatch) return;

    setSubmitting(true);
    setError(null);
    try {
      const { recoveryCode } = await setupEncryption(userId, passphrase);
      onSetupComplete(recoveryCode);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't set up encryption.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div className="text-center space-y-1.5">
        <ShieldCheck
          className="h-8 w-8 mx-auto text-brand"
          strokeWidth={1.75}
        />
        <h1 className="text-xl font-bold tracking-tight">
          Protect your content
        </h1>
        <p className="text-sm text-muted-foreground">
          Set a passphrase before you start. It never leaves your device.
        </p>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground bg-secondary/20 border border-border/50 rounded-lg p-3.5">
        <p>
          <span className="font-medium text-foreground">Protected:</span> task
          and habit names, notes, event titles and locations — the words you
          write.
        </p>
        <p>
          <span className="font-medium text-foreground">Not protected:</span>{" "}
          your identity, your email, and your schedule — dates, priorities and
          completion stay readable so reminders and stats keep working.
        </p>
      </div>

      <div
        role="alert"
        className="flex gap-2.5 text-xs text-amber-700 dark:text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3.5"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          If you lose <span className="font-medium">both</span> your passphrase
          and your recovery code, your data is unrecoverable — Kagelin cannot
          read it, so there is no support route to get it back.
        </p>
      </div>

      <AuthPasswordField
        id="encryption-passphrase"
        label="Passphrase"
        value={passphrase}
        onChange={setPassphrase}
        disabled={submitting}
        autoComplete="new-password"
      >
        <PassphraseStrengthHints
          passphrase={passphrase}
          tooShort={tooShort}
          weak={weak}
        />
      </AuthPasswordField>

      <AuthPasswordField
        id="encryption-passphrase-confirm"
        label="Confirm passphrase"
        value={confirmPassphrase}
        onChange={setConfirmPassphrase}
        disabled={submitting}
        autoComplete="new-password"
      >
        {showMismatch && (
          <p className="text-xs text-destructive">
            Passphrases don&apos;t match.
          </p>
        )}
      </AuthPasswordField>

      {error && (
        <p role="alert" className="text-sm text-destructive font-medium">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-base font-medium"
        disabled={submitting || !passphrase || tooShort || mismatch}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Setting up...
          </>
        ) : (
          "Set passphrase"
        )}
      </Button>
    </form>
  );
}

export function EncryptionSetupScreen({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  return (
    <AuthShell>
      {recoveryCode ? (
        <div className="w-full space-y-5">
          <div className="text-center space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">
              Save your recovery code
            </h1>
            <p className="text-sm text-muted-foreground">
              Use this if you ever forget your passphrase. It&apos;s shown only
              once.
            </p>
          </div>
          <RecoveryCodeDisplay
            recoveryCode={recoveryCode}
            onContinue={onComplete}
          />
        </div>
      ) : (
        <PassphraseStep userId={userId} onSetupComplete={setRecoveryCode} />
      )}
    </AuthShell>
  );
}
