import * as chrono from "chrono-node";

export interface ParsedEventInput {
  title: string;
  start?: Date;
  end?: Date;
  allDay: boolean;
}

/**
 * Parses a natural language string into event components.
 *
 * @param input - The raw text input (e.g., "Lunch at 1pm tomorrow")
 * @param refDate - The reference date for relative parsing (defaults to today)
 * @returns ParsedEventInput with title, start, end, and allDay flag
 */
export function parseEventInput(
  input: string,
  refDate: Date = new Date(),
): ParsedEventInput {
  const trimmed = input.trim();
  if (!trimmed) {
    return { title: "", allDay: false };
  }

  const results = chrono.parse(trimmed, refDate);

  if (results.length === 0) {
    return { title: trimmed, allDay: false };
  }

  // Use the first result (highest confidence)
  const result = results[0];
  const start = result.start.date();

  // If end is explicit, use it; otherwise default to start + 1 hour
  const end = result.end
    ? result.end.date()
    : new Date(start.getTime() + 3600000);

  // Strip the parsed date text from the title
  // Example: "Lunch at 1pm" -> result.text is "1pm" or "at 1pm"
  let title = trimmed.replace(result.text, "").trim();

  // Remove filler words that often precede the date if they are at the end of the title
  title = title
    .replace(/\s+(at|on|for|in|from|scheduled for|starting at)$/i, "")
    .trim();

  // Handle the case where the input was just a date (e.g., "Tomorrow")
  if (!title) {
    title = "Untitled Event";
  }

  // Also handle start of title if it was "On Monday buy milk"
  title = title.replace(/^(at|on|for|in|from)\s+/i, "").trim();

  if (!title) {
    title = "Untitled Event";
  }

  // Detect all-day: has certain day but uncertain hour
  const allDay =
    result.start.isCertain("day") && !result.start.isCertain("hour");

  return {
    title,
    start,
    end,
    allDay,
  };
}
