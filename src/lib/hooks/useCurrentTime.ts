"use client";

import { useState, useEffect } from "react";

/**
 * Hook to provide and update the current time at a regular interval.
 * @param intervalMs - The update interval in milliseconds. Defaults to 60,000 (1 minute).
 * @returns The current date and time.
 */
export function useCurrentTime(intervalMs: number = 60000) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date());
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return currentTime;
}
