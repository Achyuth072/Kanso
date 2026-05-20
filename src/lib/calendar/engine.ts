/**
 * Calendar Engine - Core Layout Logic
 * Pure functions for event positioning and overlap detection
 * Based on docs/CALENDAR.md architecture
 */

import { startOfDay, endOfDay, max, min, addDays, isSameDay } from "date-fns";
import type { CalendarEvent, PositionedEvent, DayColumn } from "./types";

/**
 * Convert minutes since start of day to percentage (0-100)
 */
function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Convert time to vertical position percentage
 * 24 hours = 100%
 */
function timeToPercent(date: Date): number {
  return (minutesSinceStartOfDay(date) / 1440) * 100;
}

/**
 * Clamp event to a specific day's boundaries
 */
function clampToDay(event: CalendarEvent, day: Date): CalendarEvent {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return {
    ...event,
    start: max([event.start, dayStart]),
    end: min([event.end, dayEnd]),
  };
}

/**
 * Group overlapping events together
 * This is critical for calculating column widths
 */

/**
 * Position events for a single day
 * Renders events as thin row strips that strictly fit within their time slot
 * Dynamic compression reduces height if many events overlap
 */
export function layoutDayEvents(
  events: CalendarEvent[],
  day: Date,
): PositionedEvent[] {
  // Filter events for this day and clamp to day boundaries
  const dayEvents = events
    .filter((e) => isSameDay(e.start, day) || isSameDay(e.end, day))
    .map((e) => clampToDay(e, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (dayEvents.length === 0) return [];

  const MAX_ROW_HEIGHT_PERCENT = 1.94; // ~28px max height
  const MIN_ROW_HEIGHT_PERCENT = 1.0; // ~14px min height
  const SLOT_HEIGHT_PERCENT = 4.16; // 1 hour (60/1440 * 100)

  const positioned: PositionedEvent[] = [];

  // Group events by hour to handle slot fitting
  const hourGroups: Record<number, CalendarEvent[]> = {};

  dayEvents.forEach((event) => {
    const hour = event.start.getHours();
    if (!hourGroups[hour]) hourGroups[hour] = [];
    hourGroups[hour].push(event);
  });

  // Process each hour group
  Object.entries(hourGroups).forEach(([_hourStr, groupEvents]) => {
    const count = groupEvents.length;
    // Calculate height: fit in slot, but clamp between min and max
    const height = Math.min(
      MAX_ROW_HEIGHT_PERCENT,
      Math.max(MIN_ROW_HEIGHT_PERCENT, SLOT_HEIGHT_PERCENT / count),
    );

    // Add a tiny gap between items unless they are very compressed
    const margin = height < 1.4 ? 0 : 0.1;

    groupEvents.forEach((event, index) => {
      const startPercent = timeToPercent(event.start);
      // Position relative to the start of the group
      const offset = index * (height + margin);

      positioned.push({
        ...event,
        top: startPercent + offset,
        height: height,
        left: 0,
        width: 100,
        column: index,
        columnSpan: 1,
      });
    });
  });

  return positioned;
}

/**
 * Generate a range of dates
 */
export function getDayRange(start: Date, days: number): Date[] {
  return Array.from({ length: days }).map((_, i) => addDays(start, i));
}

/**
 * Layout events for a range of days (Week, 3-Day, 4-Day views)
 */
export function layoutDayRange(
  events: CalendarEvent[],
  days: Date[],
): DayColumn[] {
  return days.map((day) => ({
    date: day,
    events: layoutDayEvents(events, day),
  }));
}
