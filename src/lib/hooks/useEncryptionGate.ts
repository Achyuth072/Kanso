"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { getEncryptionKeyRow } from "@/lib/crypto/keyManager";
import { keyStore } from "@/lib/crypto/keyStore";
import { purgeDeviceContent } from "@/lib/crypto/purge";
import { getIdleMs, recordActivity } from "@/lib/crypto/autoLock";
import { useAutoLockTimer } from "@/lib/hooks/useAutoLockTimer";
import { useUiStore } from "@/lib/store/uiStore";

export type EncryptionGateStatus =
  | "loading"
  | "not-applicable"
  | "needs-setup"
  | "needs-unlock"
  | "needs-migration"
  | "unlocked"
  | "unavailable";

type AsyncStatus =
  | "loading"
  | "needs-setup"
  | "needs-unlock"
  | "needs-migration"
  | "unlocked"
  | "unavailable";

export function useEncryptionGate(): {
  status: EncryptionGateStatus;
  recheck: () => void;
  lock: () => Promise<void>;
} {
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const queryClient = useQueryClient();
  const [asyncStatus, setAsyncStatus] = useState<AsyncStatus>("loading");
  const [version, setVersion] = useState(0);
  const autoLockEnabled = useUiStore((s) => s.autoLockEnabled);
  const autoLockMinutes = useUiStore((s) => s.autoLockMinutes);
  const autoLockEnabledRef = useRef(autoLockEnabled);
  const autoLockMinutesRef = useRef(autoLockMinutes);
  useEffect(() => {
    autoLockEnabledRef.current = autoLockEnabled;
    autoLockMinutesRef.current = autoLockMinutes;
  }, [autoLockEnabled, autoLockMinutes]);

  const notApplicable = !authLoading && (!user || isGuestMode);

  useEffect(() => {
    if (authLoading || notApplicable || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const [row, cachedKey] = await Promise.all([
          getEncryptionKeyRow(user.id),
          keyStore.load(),
        ]);
        if (cancelled) return;

        const wouldUnlock = !!row && !!cachedKey && row.migrated_at !== null;
        if (
          wouldUnlock &&
          autoLockEnabledRef.current &&
          // Clamp to prevent corrupted/stale values (<= 0) from firing immediately.
          getIdleMs() >= Math.max(1, autoLockMinutesRef.current) * 60_000
        ) {
          await purgeDeviceContent(queryClient);
          if (!cancelled) setAsyncStatus("needs-unlock");
          return;
        }

        setAsyncStatus(
          !row
            ? "needs-setup"
            : !cachedKey
              ? "needs-unlock"
              : // Legacy cached rows lack migrated_at; explicit null triggers migration.
                row.migrated_at === null
                ? "needs-migration"
                : "unlocked",
        );
      } catch {
        if (!cancelled) setAsyncStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, notApplicable, version, queryClient]);

  const recheck = useCallback(() => {
    recordActivity();
    setAsyncStatus("loading");
    setVersion((v) => v + 1);
  }, []);

  const lock = useCallback(async () => {
    await purgeDeviceContent(queryClient);
    setAsyncStatus("needs-unlock");
  }, [queryClient]);

  useAutoLockTimer(
    autoLockEnabled && asyncStatus === "unlocked",
    autoLockMinutes,
    lock,
  );

  const status: EncryptionGateStatus = authLoading
    ? "loading"
    : notApplicable
      ? "not-applicable"
      : asyncStatus;

  return { status, recheck, lock };
}
