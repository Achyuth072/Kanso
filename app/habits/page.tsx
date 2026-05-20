"use client";

import { HabitCard } from "@/components/habits/HabitCard";
import { useHabits, type HabitWithEntries } from "@/lib/hooks/useHabits";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Layers } from "lucide-react";
import { format } from "date-fns";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";

import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { HabitOptionsMenu } from "@/components/habits/HabitOptionsMenu";

export default function HabitsPage() {
  const { data: habits, isLoading, error } = useHabits();
  const { openAddHabit, openEditHabit } = useHabitActions();
  const { trigger } = useHaptic();

  const handleOpenCreate = () => {
    trigger("toggle");
    openAddHabit();
  };

  const handleEditHabit = (habit: HabitWithEntries) => {
    trigger("toggle");
    openEditHabit(habit);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 p-6 space-y-4"
            >
              <div className="flex justify-between">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-32 w-full mt-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-32 flex flex-col items-center justify-center gap-4">
        <AlertCircle
          className="w-12 h-12 text-destructive"
          strokeWidth={2.25}
        />
        <div className="text-center">
          <h2 className="type-h2">Failed to load habits</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <div className="container mx-auto py-32 flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-secondary/30 flex items-center justify-center mb-2">
          <Layers
            className="h-10 w-10 text-muted-foreground/60"
            strokeWidth={2.25}
          />
        </div>
        <div className="text-center space-y-2">
          <h2 className="type-h2">No habits yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Small changes lead to big results. Create your first habit to start
            tracking.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="h-10 px-6 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm shadow-brand/10 transition-seijaku gap-2"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          <span>Create Habit</span>
        </Button>
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="flex flex-col h-[calc(100dvh-124px)] md:h-dvh overflow-hidden">
      <div className="px-4 md:px-6 pt-4 pb-4 flex flex-row items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {format(today, "EEEE, MMMM d")}
          </p>
          <h1 className="type-h1 mt-1 text-primary">Habits</h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            onClick={handleOpenCreate}
            className="hidden md:flex h-9 items-center gap-2 px-4 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>New Habit</span>
          </Button>
          <HabitOptionsMenu />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 scrollbar-hide">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              icon={getHabitIcon(habit.icon)}
              onEdit={() => handleEditHabit(habit)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
