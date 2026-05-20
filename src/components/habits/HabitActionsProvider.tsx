"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Habit } from "@/lib/types/habit";

interface HabitActionsContextValue {
  isHabitSheetOpen: boolean;
  editingHabit: Habit | null;
  openAddHabit: () => void;
  openEditHabit: (habit: Habit) => void;
  closeHabitSheet: () => void;
}

const HabitActionsContext = createContext<HabitActionsContextValue | null>(
  null,
);

export function HabitActionsProvider({ children }: { children: ReactNode }) {
  const [isHabitSheetOpen, setIsHabitSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const openAddHabit = React.useCallback(() => {
    setEditingHabit(null);
    setIsHabitSheetOpen(true);
  }, []);

  const openEditHabit = React.useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setIsHabitSheetOpen(true);
  }, []);

  const closeHabitSheet = React.useCallback(() => {
    setIsHabitSheetOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({
      isHabitSheetOpen,
      editingHabit,
      openAddHabit,
      openEditHabit,
      closeHabitSheet,
    }),
    [
      isHabitSheetOpen,
      editingHabit,
      openAddHabit,
      openEditHabit,
      closeHabitSheet,
    ],
  );

  return (
    <HabitActionsContext.Provider value={value}>
      {children}
    </HabitActionsContext.Provider>
  );
}

export function useHabitActions() {
  const context = useContext(HabitActionsContext);
  if (!context) {
    throw new Error(
      "useHabitActions must be used within a HabitActionsProvider",
    );
  }
  return context;
}
