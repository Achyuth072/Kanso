"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { parseICSFile } from "@/lib/utils/ics-parser";
import { notify } from "@/lib/notify";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { calendarEventMutations } from "@/lib/mutations/calendar-event";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { isContentKeyUnavailableError } from "@/lib/supabase/wrapClient";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import {
  dedupeIcsEvents,
  isIcsUidConflict,
} from "@/lib/import/dedupeIcsEvents";
import type { CreateCalendarEventInput } from "@/lib/types/calendar-event";

export const ICS_CONFIRM_THRESHOLD = 50;

export interface IcsImportPreview {
  toCreate: CreateCalendarEventInput[];
  totalParsed: number;
  duplicateCount: number;
  earliest: string | null;
  latest: string | null;
  parseErrors: unknown[];
}

// ics_uid is unencrypted (outside FIELD_MAP) for indexed lookup without full decryption.
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

function dateRangeOf(events: CreateCalendarEventInput[]): {
  earliest: string | null;
  latest: string | null;
} {
  if (events.length === 0) return { earliest: null, latest: null };
  let earliest = events[0].start_time;
  let latest = events[0].start_time;
  for (const event of events) {
    if (event.start_time < earliest) earliest = event.start_time;
    if (event.start_time > latest) latest = event.start_time;
  }
  return { earliest, latest };
}

export function useIcsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<IcsImportPreview | null>(null);
  const { trigger } = useHaptic();
  const queryClient = useQueryClient();

  const prepareImport = async (
    file: File,
  ): Promise<IcsImportPreview | null> => {
    setIsImporting(true);
    try {
      const { events: parsedEvents, errors } = await parseICSFile(file);

      if (parsedEvents.length === 0 && errors.length > 0) {
        notify.error("Failed to parse ICS file");
        trigger("thud");
        return null;
      }

      if (parsedEvents.length === 0) {
        notify.error("No valid events found in file");
        trigger("thud");
        return null;
      }

      const { toCreate, skipped } = dedupeIcsEvents(
        parsedEvents,
        await loadExistingIcsUids(),
      );

      const result: IcsImportPreview = {
        toCreate,
        totalParsed: parsedEvents.length,
        duplicateCount: skipped,
        ...dateRangeOf(toCreate),
        parseErrors: errors,
      };
      if (result.toCreate.length >= ICS_CONFIRM_THRESHOLD) {
        setPreview(result);
      }
      return result;
    } catch (err) {
      console.error("Failed to parse ICS:", err);
      notify.error("Critical error during import");
      trigger("thud");
      return null;
    } finally {
      setIsImporting(false);
    }
  };

  const cancelImport = () => setPreview(null);

  const commitImport = async (
    target: IcsImportPreview | null = preview,
  ): Promise<boolean> => {
    if (!target) return false;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = notify.loading("Importing events...");

    try {
      if (target.toCreate.length === 0) {
        notify.success(
          target.duplicateCount > 0
            ? `Already imported — skipped ${target.duplicateCount} duplicate ${target.duplicateCount === 1 ? "event" : "events"}.`
            : "No new events to import",
          { id: loadingToastId },
        );
        trigger("success");
        return true;
      }

      let importedCount = 0;
      let conflictCount = 0;
      const failures: unknown[] = [];
      for (const eventInput of target.toCreate) {
        try {
          await calendarEventMutations.create(eventInput);
          importedCount++;
        } catch (err) {
          if (isIcsUidConflict(err)) {
            conflictCount++;
          } else {
            failures.push(err);
          }
        }
      }

      // Invalidate once for the whole batch to avoid per-event refetch and decryption.
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      notifyLocalEdit();

      const skippedTotal = target.duplicateCount + conflictCount;
      const detail = [
        skippedTotal > 0 ? `skipped ${skippedTotal} duplicate` : null,
        failures.length > 0 ? `${failures.length} failed` : null,
      ].filter(Boolean);

      notify.success(
        detail.length > 0
          ? `Imported ${importedCount} events (${detail.join(", ")})`
          : `Successfully imported ${importedCount} events`,
        { id: loadingToastId },
      );
      trigger("success");

      // Locked encryption keys are expected user state, not crashes; avoid Sentry spam.
      failures
        .filter((failure) => !isContentKeyUnavailableError(failure))
        .forEach((failure, index) => {
          Sentry.captureException(failure, {
            tags: { failureIndex: index, failedCount: failures.length },
          });
        });

      if (target.parseErrors.length > 0) {
        notify.warning(
          `${target.parseErrors.length} events had parsing warnings.`,
        );
      }

      return true;
    } catch (err) {
      console.error("Failed to import ICS:", err);
      notify.error("Critical error during import", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
      setPreview(null);
    }
  };

  return {
    prepareImport,
    commitImport,
    cancelImport,
    preview,
    isImporting,
  };
}
