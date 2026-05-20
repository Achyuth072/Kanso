"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface TaskActionsContextValue {
  isAddTaskOpen: boolean;
  openAddTask: () => void;
  closeAddTask: () => void;
}

const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const openAddTask = React.useCallback(() => setIsAddTaskOpen(true), []);
  const closeAddTask = React.useCallback(() => setIsAddTaskOpen(false), []);

  const value = React.useMemo(
    () => ({
      isAddTaskOpen,
      openAddTask,
      closeAddTask,
    }),
    [isAddTaskOpen, openAddTask, closeAddTask],
  );

  return (
    <TaskActionsContext.Provider value={value}>
      {children}
    </TaskActionsContext.Provider>
  );
}

export function useTaskActions() {
  const context = useContext(TaskActionsContext);
  if (!context) {
    throw new Error("useTaskActions must be used within a TaskActionsProvider");
  }
  return context;
}
