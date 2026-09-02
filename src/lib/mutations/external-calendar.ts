import { keyStore } from "@/lib/crypto/keyStore";
import { encryptField } from "@/lib/crypto/contentCipher";
import type {
  CalendarProvider,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";

// Encrypts `name` here rather than via FIELD_MAP: the row is written with the
// service-role client, which bypasses the encrypting Supabase wrapper.
export async function connectCalendars(
  provider: CalendarProvider,
  picked: DiscoveredCalendar[],
): Promise<void> {
  const key = await keyStore.load();
  if (!key) {
    throw new Error("Unlock Kagelin before connecting a calendar");
  }

  const calendars = await Promise.all(
    picked.map(async (calendar) => ({
      remote_calendar_id: calendar.url,
      name: await encryptField(key, calendar.displayName),
      color: calendar.color,
    })),
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
