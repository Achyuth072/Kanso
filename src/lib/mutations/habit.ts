import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import type { Habit, HabitEntry } from "@/lib/types/habit";

export interface CreateHabitInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  start_date?: string;
}

export interface UpdateHabitInput {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface MarkHabitCompleteInput {
  habitId: string;
  date: string;
  value?: number;
}

export const habitMutations = {
  create: async (input: CreateHabitInput): Promise<Habit> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      return mockStore.addHabit({
        name: input.name,
        description: input.description || null,
        color: input.color || "#4B6CB7",
        icon: input.icon || null,
        archived_at: null,
        start_date: input.start_date || new Date().toISOString().split("T")[0],
      });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("habits")
      .insert({
        user_id: user.id,
        name: input.name,
        description: input.description || null,
        color: input.color || "#4B6CB7",
        icon: input.icon || null,
        start_date: input.start_date || new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Habit;
  },

  update: async (input: UpdateHabitInput): Promise<Habit> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { id, ...updates } = input;

    if (isGuest) {
      const result = mockStore.updateHabit(id, updates);
      if (!result) throw new Error("Habit not found");
      return result;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("habits")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Habit;
  },

  delete: async (habitId: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const success = mockStore.deleteHabit(habitId);
      if (!success) throw new Error("Habit not found");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("habits").delete().eq("id", habitId);
    if (error) throw new Error(error.message);
  },

  markComplete: async (input: MarkHabitCompleteInput): Promise<HabitEntry> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const { habitId, date } = input;
      const entry = mockStore.toggleHabitEntry(habitId, date);
      return entry || ({ habit_id: habitId, date, value: 0 } as HabitEntry);
    }

    const { habitId, date, value = 1 } = input;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("habit_entries")
      .upsert(
        { habit_id: habitId, date, value },
        { onConflict: "habit_id,date" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as HabitEntry;
  },
};
