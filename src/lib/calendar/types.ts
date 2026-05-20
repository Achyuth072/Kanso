import type { CalendarEventUI } from "@/lib/types/calendar-event";
export type { CalendarEventUI } from "@/lib/types/calendar-event";
export { toCalendarEventUI } from "@/lib/types/calendar-event";

// Alias for backward compatibility with existing views
export type CalendarEvent = CalendarEventUI;

export type PositionedEvent = CalendarEvent & {
  top: number; // % from top (0-100)
  height: number; // % height (0-100)
  left: number; // % from left (0-100)
  width: number; // % width (0-100)
  column: number; // overlap column index
  columnSpan: number; // total columns in overlap group
};

export type DayColumn = {
  date: Date;
  events: PositionedEvent[];
};

export type CalendarView =
  | "year"
  | "month"
  | "week"
  | "day"
  | "4day"
  | "3day"
  | "schedule";
