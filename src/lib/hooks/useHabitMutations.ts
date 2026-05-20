"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { handleMutationError } from "@/lib/utils/mutation-error";
import type { HabitEntry, HabitWithEntries } from "@/lib/types/habit";

import { habitMutations } from "@/lib/mutations/habit";

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["createHabit"],
    mutationFn: habitMutations.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["updateHabit"],
    mutationFn: habitMutations.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["deleteHabit"],
    mutationFn: habitMutations.delete,
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const previousHabits = queryClient.getQueryData<HabitWithEntries[]>([
        "habits",
        { includeArchived: false, isGuestMode },
      ]);

      // Optimistically remove from cache
      queryClient.setQueryData<HabitWithEntries[]>(
        ["habits", { includeArchived: false, isGuestMode }],
        (old) => old?.filter((habit) => habit.id !== habitId),
      );

      return { previousHabits };
    },
    onError: (err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode }],
          context.previousHabits,
        );
      }
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

export function useMarkHabitComplete() {
  const queryClient = useQueryClient();
  const { isGuestMode } = useAuth();

  return useMutation({
    mutationKey: ["markHabitComplete"],
    mutationFn: habitMutations.markComplete,
    onMutate: async ({ habitId, date, value = 1 }) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });

      const previousHabits = queryClient.getQueryData<HabitWithEntries[]>([
        "habits",
        { includeArchived: false, isGuestMode },
      ]);

      // Optimistically update the entry
      queryClient.setQueryData<HabitWithEntries[]>(
        ["habits", { includeArchived: false, isGuestMode }],
        (old) =>
          old?.map((habit) => {
            if (habit.id !== habitId) return habit;

            const existingEntryIndex = habit.entries.findIndex(
              (e) => e.date === date,
            );

            if (existingEntryIndex >= 0) {
              // Update existing entry
              const updatedEntries = [...habit.entries];
              updatedEntries[existingEntryIndex] = {
                ...updatedEntries[existingEntryIndex],
                value,
              };
              return { ...habit, entries: updatedEntries };
            } else {
              // Add new entry
              const newEntry: HabitEntry = {
                id: crypto.randomUUID(), // Temporary ID
                habit_id: habitId,
                date,
                value,
                created_at: new Date().toISOString(),
              };
              return {
                ...habit,
                entries: [...habit.entries, newEntry],
              };
            }
          }),
      );

      return { previousHabits };
    },
    onError: (err, _vars, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode }],
          context.previousHabits,
        );
      }
      handleMutationError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
