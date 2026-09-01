"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { Button } from "@/components/ui/button";
import { AUTH_LINK_CLASS } from "@/components/auth/authLinkClass";
import {
  unlockWithPassphrase,
  unlockWithRecoveryCode,
} from "@/lib/crypto/keyManager";

export function UnlockScreen({
  userId,
  onUnlocked,
}: {
  userId: string;
  onUnlocked: () => void;
}) {
  const [mode, setMode] = useState<"passphrase" | "recovery-code">(
    "passphrase",
  );
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;

    setSubmitting(true);
    setError(null);
    try {
      if (mode === "passphrase") {
        await unlockWithPassphrase(userId, value);
      } else {
        await unlockWithRecoveryCode(userId, value);
      }
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full space-y-5">
        <div className="text-center space-y-1.5">
          <Lock className="h-8 w-8 mx-auto text-brand" strokeWidth={1.75} />
          <h1 className="text-xl font-bold tracking-tight">
            Unlock your content
          </h1>
          <p className="text-sm text-muted-foreground">
            This device doesn&apos;t have your key yet. Enter your{" "}
            {mode === "passphrase" ? "passphrase" : "recovery code"} to
            continue.
          </p>
          <p className="text-xs text-muted-foreground/80">
            Reminders can only say something is due, not what, until you unlock.
          </p>
        </div>

        <AuthPasswordField
          id="unlock-secret"
          label={mode === "passphrase" ? "Passphrase" : "Recovery code"}
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(null);
          }}
          disabled={submitting}
          autoComplete="current-password"
        />

        {error && (
          <p role="alert" className="text-sm text-destructive font-medium">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={submitting || !value}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Unlocking...
            </>
          ) : (
            "Unlock"
          )}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode((m) =>
              m === "passphrase" ? "recovery-code" : "passphrase",
            );
            setValue("");
            setError(null);
          }}
          className={`${AUTH_LINK_CLASS} block mx-auto`}
        >
          {mode === "passphrase"
            ? "Use my recovery code instead"
            : "Use my passphrase instead"}
        </button>
      </form>
    </AuthShell>
  );
}
