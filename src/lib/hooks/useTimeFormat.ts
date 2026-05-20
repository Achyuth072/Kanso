"use client";

import { format } from "date-fns";
import { useUiStore } from "@/lib/store/uiStore";
import { useCallback } from "react";

/**
 * Hook to format time based on the user's preference (12h/24h/system).
 */
export const useTimeFormat = () => {
  const timeFormat = useUiStore((state) => state.timeFormat);

  const formatTime = useCallback(
    (date: Date) => {
      // 24-hour format: 14:30
      if (timeFormat === "24h") {
        return format(date, "HH:mm");
      }

      // System format: detect from browser locale using Intl.DateTimeFormat
      if (timeFormat === "system") {
        const is24hr = new Intl.DateTimeFormat(navigator.language, {
          hour: "numeric",
        })
          .formatToParts(new Date(2024, 0, 1, 14, 0))
          .some((part) => part.value === "14");
        return is24hr ? format(date, "HH:mm") : format(date, "h:mm a");
      }

      // 12-hour format: 2:30 PM (default or explicit)
      return format(date, "h:mm a");
    },
    [timeFormat],
  );

  const formatDateWithTime = useCallback(
    (date: Date, dateFormat: string) => {
      const timePart = formatTime(date);
      return `${format(date, dateFormat)} ${timePart}`;
    },
    [formatTime],
  );

  return { formatTime, formatDateWithTime, timeFormat };
};
