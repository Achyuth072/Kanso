"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { RecoveryCodeDisplay } from "@/components/encryption/RecoveryCodeDisplay";
import { PassphraseStrengthHints } from "@/components/encryption/PassphraseStrengthHints";
import { Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { changePassphrase, reissueRecoveryCode } from "@/lib/crypto/keyManager";
import { checkPassphraseStrength } from "@/lib/crypto/passphraseStrength";
import { notify } from "@/lib/notify";
import { SETTINGS_CARD_CLASS } from "@/components/settings/settingsCardClass";
import { useEncryptionGateActions } from "@/components/encryption/EncryptionGate";

function LockNowCard() {
  const { lock } = useEncryptionGateActions();
  const [locking, setLocking] = useState(false);

  const handleLock = async () => {
    setLocking(true);
    try {
      await lock();
      // On success this component unmounts — the gate swaps in the unlock
      // screen — so there is no "locked" state to reset back to here.
    } catch (err) {
      setLocking(false);
      notify.error(
        err instanceof Error ? err.message : "Couldn't lock right now.",
      );
    }
  };

  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <CardHeader className="pb-3 px-4 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
          <Lock className="h-4 w-4 text-brand" strokeWidth={2.25} />
          Lock Now
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/80 lowercase">
          Discards your key and decrypted data from this device without signing
          out. Unlocking again only asks for your passphrase.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-0">
        <Button
          type="button"
          variant="outline"
          disabled={locking}
          onClick={handleLock}
          className="h-11 sm:h-9 px-4 text-xs font-semibold border-border/50"
        >
          {locking ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Locking...
            </>
          ) : (
            "Lock now"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ChangePassphraseCard({ userId }: { userId: string }) {
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { tooShort, weak } = checkPassphraseStrength(newPassphrase);
  const mismatch =
    confirmPassphrase.length > 0 && confirmPassphrase !== newPassphrase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassphrase || !newPassphrase || tooShort || mismatch) return;

    setSubmitting(true);
    setError(null);
    try {
      await changePassphrase(userId, currentPassphrase, newPassphrase);
      notify.success("Passphrase changed");
      setCurrentPassphrase("");
      setNewPassphrase("");
      setConfirmPassphrase("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't change passphrase.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <CardHeader className="pb-3 px-4 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
          <ShieldCheck className="h-4 w-4 text-brand" strokeWidth={2.25} />
          Change Passphrase
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/80 lowercase">
          Rewraps your content key. Your content itself is never re-read or
          re-uploaded.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthPasswordField
            id="encryption-current-passphrase"
            label="Current Passphrase"
            labelClassName="text-[11px] uppercase tracking-wider text-muted-foreground/60"
            value={currentPassphrase}
            onChange={setCurrentPassphrase}
            disabled={submitting}
            autoComplete="current-password"
          />

          <AuthPasswordField
            id="encryption-new-passphrase"
            label="New Passphrase"
            labelClassName="text-[11px] uppercase tracking-wider text-muted-foreground/60"
            value={newPassphrase}
            onChange={setNewPassphrase}
            disabled={submitting}
            autoComplete="new-password"
          >
            <PassphraseStrengthHints
              passphrase={newPassphrase}
              tooShort={tooShort}
              weak={weak}
            />
          </AuthPasswordField>

          <AuthPasswordField
            id="encryption-confirm-new-passphrase"
            label="Confirm New Passphrase"
            labelClassName="text-[11px] uppercase tracking-wider text-muted-foreground/60"
            value={confirmPassphrase}
            onChange={setConfirmPassphrase}
            disabled={submitting}
            autoComplete="new-password"
          >
            {mismatch && (
              <p className="text-xs text-destructive">
                Passphrases don&apos;t match.
              </p>
            )}
          </AuthPasswordField>

          {error && (
            <p role="alert" className="text-xs text-destructive font-medium">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={
              submitting ||
              !currentPassphrase ||
              !newPassphrase ||
              tooShort ||
              mismatch
            }
            className="h-11 sm:h-9 px-4 text-xs font-semibold bg-brand hover:bg-brand/90 text-brand-foreground transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Changing...
              </>
            ) : (
              "Change passphrase"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecoveryCodeCard({ userId }: { userId: string }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const code = await reissueRecoveryCode(userId);
      setNewCode(code);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't generate a new code.";
      setError(message);
      notify.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className={SETTINGS_CARD_CLASS}>
      <CardHeader className="pb-3 px-4 pt-5">
        <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
          <RefreshCw className="h-4 w-4 text-brand" strokeWidth={2.25} />
          Recovery Code
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground/80 lowercase">
          Generating a new code immediately invalidates your old one.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-5 pt-0 space-y-3">
        {error && (
          <p role="alert" className="text-xs text-destructive font-medium">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={generating}
          onClick={handleGenerate}
          className="h-11 sm:h-9 px-4 text-xs font-semibold border-border/50"
        >
          {generating ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate new recovery code"
          )}
        </Button>
      </CardContent>

      <ResponsiveDialog
        open={newCode !== null}
        onOpenChange={(open) => {
          if (!open) setNewCode(null);
        }}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>New recovery code</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Your old recovery code no longer works. Save this one — it&apos;s
              shown only once.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          {newCode && (
            <RecoveryCodeDisplay
              recoveryCode={newCode}
              onContinue={() => setNewCode(null)}
              continueLabel="Done"
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </Card>
  );
}

export function EncryptionSection() {
  const { user, isGuestMode } = useAuth();

  if (isGuestMode || !user) return null;

  return (
    <div className="space-y-6">
      <LockNowCard />
      <ChangePassphraseCard userId={user.id} />
      <RecoveryCodeCard userId={user.id} />
    </div>
  );
}
