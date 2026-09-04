"use client";

import { useEffect, useRef } from "react";
import { recordActivity, getIdleMs } from "@/lib/crypto/autoLock";

const ACTIVITY_EVENTS = ["pointerdown", "keydown"] as const;
const CHECK_INTERVAL_MS = 15_000;
const RECORD_THROTTLE_MS = 10_000;

export function useAutoLockTimer(
  enabled: boolean,
  minutes: number,
  onTimeout: () => void,
) {
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    recordActivity();
    let lastWrite = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastWrite < RECORD_THROTTLE_MS) return;
      lastWrite = now;
      recordActivity();
    };
    const thresholdMs = minutes * 60_000;
    const checkIdle = () => {
      if (getIdleMs() >= thresholdMs) onTimeoutRef.current();
    };
    // Background tab timers are throttled; check immediately when visible.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkIdle();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [enabled, minutes]);
}
