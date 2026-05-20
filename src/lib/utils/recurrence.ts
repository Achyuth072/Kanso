import { addDays, addWeeks, addMonths, addYears } from "date-fns";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceRule {
  freq: RecurrenceFrequency;
  interval: number;
  days?: number[]; // For WEEKLY: 0=Sun, 1=Mon, etc.
  mode?: "strict" | "flexible";
}

/**
 * Calculate the next due date for a recurring task
 * @param completedDate - The date the task was completed
 * @param rule - The recurrence rule
 * @param originalDueDate - The original due date (required for 'strict' mode)
 * @returns The next due date
 */
export function calculateNextDueDate(
  completedDate: Date,
  rule: RecurrenceRule,
  originalDueDate?: Date | string | null,
): Date {
  const { freq, interval, mode = "flexible" } = rule;

  // Use originalDueDate as base if mode is strict, otherwise use completedDate
  let baseDate = completedDate;
  if (mode === "strict" && originalDueDate) {
    baseDate =
      typeof originalDueDate === "string"
        ? new Date(originalDueDate)
        : originalDueDate;
  }

  switch (freq) {
    case "DAILY":
      return addDays(baseDate, interval);

    case "WEEKLY":
      return addWeeks(baseDate, interval);

    case "MONTHLY":
      return addMonths(baseDate, interval);

    case "YEARLY":
      return addYears(baseDate, interval);

    default:
      throw new Error(`Unsupported recurrence frequency: ${freq}`);
  }
}

/**
 * Format a recurrence rule into a human-readable string
 * @param rule - The recurrence rule
 * @returns Human-readable string (e.g., "Every 2 weeks", "Daily")
 */
export function formatRecurrenceRule(rule: RecurrenceRule | null): string {
  if (!rule) return "Does not repeat";

  const { freq, interval } = rule;

  if (interval === 1) {
    switch (freq) {
      case "DAILY":
        return "Daily";
      case "WEEKLY":
        return "Weekly";
      case "MONTHLY":
        return "Monthly";
      case "YEARLY":
        return "Yearly";
    }
  }

  const unit = freq.toLowerCase().replace("ly", "");
  return `Every ${interval} ${unit}s`;
}
