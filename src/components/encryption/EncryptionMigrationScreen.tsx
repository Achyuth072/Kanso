"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  runBackfillMigration,
  type MigrationProgress,
} from "@/lib/crypto/backfillMigration";
import { markMigrationComplete } from "@/lib/crypto/keyManager";

export function EncryptionMigrationScreen({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;

    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await runBackfillMigration(userId, (p) => {
          if (!cancelled) setProgress(p);
        });
        await markMigrationComplete(userId);
        if (!cancelled) onComplete();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't finish encrypting.",
          );
        }
      } finally {
        running.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, onComplete, attempt]);

  const percent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : progress
        ? 100
        : 0;

  return (
    <AuthShell>
      <div className="w-full space-y-5 text-center">
        <ShieldCheck
          className="h-8 w-8 mx-auto text-brand"
          strokeWidth={1.75}
        />
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">
            Encrypting your content
          </h1>
          <p className="text-sm text-muted-foreground">
            {progress && progress.total > 0
              ? `Encrypting ${progress.table} — ${progress.done} of ${progress.total}`
              : "Checking your existing data..."}
          </p>
          <p className="text-xs text-muted-foreground/80">
            This runs once. It&apos;s safe to close this tab — it picks up where
            it left off.
          </p>
        </div>

        <Progress value={percent} aria-label="Encryption progress" />

        {error && (
          <div
            role="alert"
            className="flex gap-2.5 text-left text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg p-3.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {error && (
          <Button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="w-full h-11 text-base font-medium"
          >
            Try again
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
