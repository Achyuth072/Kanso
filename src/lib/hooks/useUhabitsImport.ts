"use client";

import { useState } from "react";
import { parseUhabitsFile } from "@/lib/import/uhabits";
import { classifyUhabitsError } from "@/lib/import/uhabitsErrors";
import { toast } from "sonner";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useCreateHabit } from "@/lib/hooks/useHabitMutations";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";

const ENTRY_CHUNK_SIZE = 500;

export function useUhabitsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const { trigger } = useHaptic();
  const createHabit = useCreateHabit();
  const queryClient = useQueryClient();

  const importUhabits = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    trigger("toggle");
    const loadingToastId = toast.loading(`Parsing ${file.name}...`);

    try {
      const { habits, entries } = await parseUhabitsFile(file);

      if (habits.length === 0) {
        toast.error("No compatible habits found in the database", {
          id: loadingToastId,
        });
        return;
      }

      const isGuest =
        typeof window !== "undefined" &&
        localStorage.getItem("kanso_guest_mode") === "true";

      // Detect duplicate habits by name to avoid re-importing
      let habitsToImport = habits;
      let skippedCount = 0;
      if (!isGuest) {
        const supabase = createClient();
        const { data: existing } = await supabase.from("habits").select("name");
        if (existing && existing.length > 0) {
          const existingNames = new Set(
            existing.map((h) => h.name.toLowerCase()),
          );
          habitsToImport = habits.filter(
            (h) => !existingNames.has(h.name.toLowerCase()),
          );
          skippedCount = habits.length - habitsToImport.length;
        }
      } else {
        const existingNames = new Set(
          mockStore.getHabits().map((h) => h.name.toLowerCase()),
        );
        habitsToImport = habits.filter(
          (h) => !existingNames.has(h.name.toLowerCase()),
        );
        skippedCount = habits.length - habitsToImport.length;
      }

      if (habitsToImport.length === 0) {
        toast.info(
          `All ${habits.length} habits already exist — nothing imported`,
          { id: loadingToastId },
        );
        return true;
      }

      toast.loading(`Importing ${habitsToImport.length} habits...`, {
        id: loadingToastId,
      });

      // Build set of skipped temp IDs so their entries are also dropped
      const skippedTempIds = new Set(
        habits.filter((h) => !habitsToImport.includes(h)).map((h) => h.id),
      );

      // Track tempId (from parseUhabitsFile) → actualId (from DB / mock store)
      const habitIdMap = new Map<string, string>();

      for (const habit of habitsToImport) {
        const created = await createHabit.mutateAsync({
          name: habit.name,
          description: habit.description || undefined,
          color: habit.color,
          icon: habit.icon || undefined,
          start_date: habit.start_date,
        });
        habitIdMap.set(habit.id, created.id);
      }

      // Insert habit entries with remapped IDs
      if (entries.length > 0) {
        toast.loading(
          `Importing ${habits.length} habits and ${entries.length} history entries...`,
          { id: loadingToastId },
        );

        const remapped = entries
          .filter((e) => !skippedTempIds.has(e.habit_id))
          .map((e) => ({
            id: crypto.randomUUID(),
            habit_id: habitIdMap.get(e.habit_id) ?? null,
            date: e.date,
            value: e.value,
            created_at: e.created_at,
          }))
          .filter(
            (e): e is typeof e & { habit_id: string } => e.habit_id !== null,
          );

        if (isGuest) {
          for (const entry of remapped) {
            mockStore.addHabitEntry(entry);
          }
        } else {
          const supabase = createClient();
          for (let i = 0; i < remapped.length; i += ENTRY_CHUNK_SIZE) {
            const { error } = await supabase
              .from("habit_entries")
              .insert(remapped.slice(i, i + ENTRY_CHUNK_SIZE));
            if (error) throw error;
          }
        }
      }

      // Refresh habits query
      await queryClient.invalidateQueries({ queryKey: ["habits"] });

      const skippedMsg =
        skippedCount > 0 ? ` (${skippedCount} already existed, skipped)` : "";
      toast.success(
        `Imported ${habitsToImport.length} habits with ${entries.length} history entries${skippedMsg}`,
        { id: loadingToastId },
      );
      trigger("success");
      return true;
    } catch (err) {
      console.error("Import failed:", err);
      const message = classifyUhabitsError(err);
      toast.error(message, { id: loadingToastId });
      trigger("thud");
      return false;
    } finally {
      setIsImporting(false);
    }
  };

  return { importUhabits, isImporting };
}
