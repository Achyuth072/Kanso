import { encryptPayload } from "@/lib/supabase/wrapClient";
import type {
  CalendarProvider,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";

// Encrypts `name` here rather than relying on wrapSupabaseClient: the row is
// written via the API route's service-role client, which bypasses it.
export async function connectCalendars(
  provider: CalendarProvider,
  picked: DiscoveredCalendar[],
): Promise<void> {
  const calendars = await Promise.all(
    picked.map(async (calendar) => {
      const { name } = (await encryptPayload("external_calendars", {
        name: calendar.displayName,
      })) as { name: string };
      return {
        remote_calendar_id: calendar.url,
        name,
        color: calendar.color,
      };
    }),
  );

  const res = await fetch("/api/calendar/calendars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, calendars }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    throw new Error(error || "Failed to save");
  }
}
