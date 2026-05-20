"use client";

import { useState } from "react";
import { parseICSFile } from "@/lib/utils/ics-parser";
import { toast } from "sonner";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useCreateCalendarEvent } from "@/lib/hooks/useCalendarEventMutations";

export function useIcsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const { trigger } = useHaptic();
  const createEvent = useCreateCalendarEvent();

  const importIcs = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = toast.loading(`Importing ${file.name}...`);

    try {
      const { events: parsedEvents, errors } = await parseICSFile(file);

      if (parsedEvents.length === 0 && errors.length > 0) {
        toast.error("Failed to parse ICS file", { id: loadingToastId });
        trigger("thud");
        return false;
      }

      if (parsedEvents.length === 0) {
        toast.error("No valid events found in file", { id: loadingToastId });
        trigger("thud");
        return false;
      }

      // Create each event sequentially
      let importedCount = 0;
      for (const eventInput of parsedEvents) {
        try {
          await createEvent.mutateAsync(eventInput);
          importedCount++;
        } catch (err) {
          console.error("Failed to import single event:", err);
        }
      }

      toast.success(`Successfully imported ${importedCount} events`, {
        id: loadingToastId,
      });
      trigger("success");

      if (errors.length > 0) {
        toast.warning(`${errors.length} events had parsing warnings.`);
      }

      return true;
    } catch (err) {
      console.error("Failed to import ICS:", err);
      toast.error("Critical error during import", { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
    }
  };

  return { importIcs, isImporting };
}
