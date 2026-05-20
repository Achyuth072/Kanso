"use client";

import React from "react";
import { ActivityCalendar } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { useTheme } from "next-themes";
import type { HabitEntry } from "@/lib/hooks/useHabits";

interface HabitHeatmapProps {
  entries: HabitEntry[];
  color: string;
  className?: string;
  blockSize?: number;
  blockMargin?: number;
  startDate?: string;
}

/**
 * HabitHeatmap Component
 *
 * Renders a GitHub-style activity heatmap for habit tracking.
 * Uses react-activity-calendar with a monochromatic theme based on habit color.
 *
 * @param entries - Array of habit entries (date + value)
 * @param color - Hex color for the habit (e.g., "#10b981")
 * @param className - Optional CSS class for container styling
 * @param blockSize - Size of each block in pixels
 * @param blockMargin - Margin between blocks in pixels
 */
export function HabitHeatmap({
  entries,
  color,
  className,
  blockSize = 9,
  blockMargin = 2,
  startDate,
}: HabitHeatmapProps) {
  const { resolvedTheme } = useTheme();

  // Transform habit entries to react-activity-calendar format
  // We ensure the start_date and today are at least represented to fix the range
  const today = new Date().toISOString().split("T")[0];
  const dataMap = new Map(entries.map((e) => [e.date, e.value]));

  // If startDate is provided, ensure it's in the map (even if 0)
  if (startDate && !dataMap.has(startDate)) {
    dataMap.set(startDate, 0);
  }

  // Ensure today is in the map to anchor the right side
  if (!dataMap.has(today)) {
    dataMap.set(today, 0);
  }

  const calendarData = Array.from(dataMap.entries())
    .map(([date, value]) => ({
      date,
      count: value,
      level: value === 0 ? 0 : Math.min(Math.ceil(value * 4), 4),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Generate monochromatic theme from base to habit color
  const theme = {
    dark: ["#262626", `${color}33`, `${color}66`, `${color}99`, color],
    light: ["#ebebeb", `${color}33`, `${color}66`, `${color}99`, color],
  };

  return (
    <div className={className} style={{ width: "fit-content" }}>
      <ActivityCalendar
        data={calendarData}
        theme={theme}
        colorScheme={(resolvedTheme as "light" | "dark") || "light"}
        blockSize={blockSize}
        blockMargin={blockMargin}
        blockRadius={2}
        fontSize={12}
        showColorLegend={false}
        showMonthLabels={false}
        showTotalCount={false}
        labels={{
          months: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          totalCount: "{{count}} completions in {{year}}",
          legend: {
            less: "Less",
            more: "More",
          },
        }}
      />
    </div>
  );
}
