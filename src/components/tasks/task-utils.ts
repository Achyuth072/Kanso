import {
  parseISO,
  isToday,
  isTomorrow,
  format,
  isBefore,
  startOfDay,
} from "date-fns";

export const priorityTextClasses: Record<1 | 2 | 3 | 4, string> = {
  1: "text-foreground font-bold",
  2: "text-foreground font-semibold",
  3: "text-foreground/90 font-medium",
  4: "text-muted-foreground",
};

/**
 * Universal High-Contrast Ink Checkbox Mapping
 * All priorities use the same high-intensity tokens for component-level predictability.
 */
export const priorityCheckboxClasses: Record<1 | 2 | 3 | 4, string> = {
  1: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  2: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  3: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
  4: "border-foreground/80 data-[state=checked]:bg-foreground data-[state=checked]:border-foreground",
};

export function formatDueDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

export function isOverdue(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = parseISO(dateString);
  return isBefore(date, startOfDay(new Date())) && !isToday(date);
}
