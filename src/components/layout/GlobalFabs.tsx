"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { useCalendarStore } from "@/lib/calendar/store";
import { useTasks } from "@/lib/hooks/useTasks";
import { useHabits } from "@/lib/hooks/useHabits";
import AddTaskFab from "@/components/tasks/AddTaskFab";
import AddHabitFab from "@/components/habits/AddHabitFab";
import AddEventFab from "@/components/calendar/AddEventFab";

export const GlobalFabs = React.memo(function GlobalFabs() {
  const pathname = usePathname();
  const isTasksPage = pathname === "/";
  const isHabitsPage = pathname === "/habits";
  const isCalendarPage = pathname === "/calendar";

  const { openAddTask } = useTaskActions();
  const { openAddHabit } = useHabitActions();
  const { openCreateEvent } = useCalendarStore();

  // Fetch only what's needed for FAB conditional rendering
  const { data: tasks } = useTasks({});
  const { data: habits } = useHabits();

  const hasActiveTasks =
    (tasks?.filter((t) => !t.is_completed).length ?? 0) > 0;
  const hasHabits = (habits?.length ?? 0) > 0;

  return (
    <>
      {isTasksPage && hasActiveTasks && (
        <AddTaskFab onPointerDown={openAddTask} />
      )}
      {isHabitsPage && hasHabits && <AddHabitFab onClick={openAddHabit} />}
      {isCalendarPage && <AddEventFab onClick={() => openCreateEvent()} />}
    </>
  );
});
