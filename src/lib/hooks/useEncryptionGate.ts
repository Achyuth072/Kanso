"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { hasEncryptionKey } from "@/lib/crypto/keyManager";
import { keyStore } from "@/lib/crypto/keyStore";
import { purgeDeviceContent } from "@/lib/crypto/purge";

export type EncryptionGateStatus =
  | "loading"
  | "not-applicable"
  | "needs-setup"
  | "needs-unlock"
  | "unlocked"
  | "unavailable";

type AsyncStatus =
  "loading" | "needs-setup" | "needs-unlock" | "unlocked" | "unavailable";

export function useEncryptionGate(): {
  status: EncryptionGateStatus;
  recheck: () => void;
  lock: () => Promise<void>;
} {
  const { user, loading: authLoading, isGuestMode } = useAuth();
  const queryClient = useQueryClient();
  const [asyncStatus, setAsyncStatus] = useState<AsyncStatus>("loading");
  const [version, setVersion] = useState(0);

  const notApplicable = !authLoading && (!user || isGuestMode);

  useEffect(() => {
    if (authLoading || notApplicable || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const [keyExists, cachedKey] = await Promise.all([
          hasEncryptionKey(user.id),
          keyStore.load(),
        ]);
        if (cancelled) return;
        setAsyncStatus(
          !keyExists ? "needs-setup" : !cachedKey ? "needs-unlock" : "unlocked",
        );
      } catch {
        // Offline with no cached key row: neither screen below can be chosen
        // (unlocking needs the same row), so surface a retry rather than
        // leaving the app on its loading overlay forever.
        if (!cancelled) setAsyncStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, notApplicable, version]);

  const recheck = useCallback(() => {
    // Retrying from "unavailable" otherwise leaves that screen up until the
    // re-check resolves, so the button looks like it did nothing.
    setAsyncStatus("loading");
    setVersion((v) => v + 1);
  }, []);

  // Purges are local IndexedDB operations, so locking never depends on the
  // network — the status flips the instant the purge resolves, no re-fetch.
  const lock = useCallback(async () => {
    await purgeDeviceContent(queryClient);
    setAsyncStatus("needs-unlock");
  }, [queryClient]);

  const status: EncryptionGateStatus = authLoading
    ? "loading"
    : notApplicable
      ? "not-applicable"
      : asyncStatus;

  return { status, recheck, lock };
}
