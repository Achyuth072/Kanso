"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { parseICSFile } from "@/lib/utils/ics-parser";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useCreateCalendarEvent } from "@/lib/hooks/useCalendarEventMutations";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { dedupeIcsEvents } from "@/lib/import/dedupeIcsEvents";

// ics_uid is deliberately outside FIELD_MAP, so it stays readable and this
// stays a cheap indexed lookup rather than a decrypt-everything scan.
async function loadExistingIcsUids(): Promise<Set<string>> {
  const isGuest =
    typeof window !== "undefined" &&
    localStorage.getItem("kanso_guest_mode") === "true";
  if (isGuest) return new Set();

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return new Set();

  const rows = await fetchAllRows<{ ics_uid: string | null }>((from, to) =>
    supabase
      .from("calendar_events")
      .select("ics_uid")
      .eq("user_id", user.id)
      .not("ics_uid", "is", null)
      .order("ics_uid", { ascending: true })
      .range(from, to),
  );

  return new Set(
    rows
      .map((r) => r.ics_uid)
      .filter((uid): uid is string => typeof uid === "string"),
  );
}

export function useIcsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const { trigger } = useHaptic();
  const createEvent = useCreateCalendarEvent();

  const importIcs = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading(`Importing ${file.name}...`);

    try {
      const { events: parsedEvents, errors } = await parseICSFile(file);

      if (parsedEvents.length === 0 && errors.length > 0) {
        notify.error("Failed to parse ICS file", { id: loadingToastId });
        trigger("thud");
        return false;
      }

      if (parsedEvents.length === 0) {
        notify.error("No valid events found in file", { id: loadingToastId });
        trigger("thud");
        return false;
      }

      const { toCreate, skipped } = dedupeIcsEvents(
        parsedEvents,
        await loadExistingIcsUids(),
      );

      if (toCreate.length === 0) {
        notify.success(
          skipped > 0
            ? `Already imported — skipped ${skipped} duplicate ${skipped === 1 ? "event" : "events"}.`
            : "No new events to import",
          { id: loadingToastId },
        );
        trigger("success");
        return true;
      }

      let importedCount = 0;
      const failures: unknown[] = [];
      for (const eventInput of toCreate) {
        try {
          await createEvent.mutateAsync(eventInput);
          importedCount++;
        } catch (err) {
          failures.push(err);
        }
      }

      const detail = [
        skipped > 0 ? `skipped ${skipped} duplicate` : null,
        failures.length > 0 ? `${failures.length} failed` : null,
      ].filter(Boolean);

      notify.success(
        detail.length > 0
          ? `Imported ${importedCount} events (${detail.join(", ")})`
          : `Successfully imported ${importedCount} events`,
        { id: loadingToastId },
      );
      trigger("success");

      if (failures.length > 0) {
        Sentry.captureException(failures[0], {
          extra: { failedCount: failures.length, total: toCreate.length },
        });
      }

      if (errors.length > 0) {
        notify.warning(`${errors.length} events had parsing warnings.`);
      }

      return true;
    } catch (err) {
      console.error("Failed to import ICS:", err);
      notify.error("Critical error during import", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
    }
  };

  return { importIcs, isImporting };
}
