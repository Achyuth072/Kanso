"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import dynamic from "next/dynamic";

const CompletedTasksSheet = dynamic(
  () =>
    import("@/components/tasks/CompletedTasksSheet").then(
      (mod) => mod.CompletedTasksSheet,
    ),
  { ssr: false },
);

interface CompletedTasksContextValue {
  showCompleted: boolean;
  toggleShowCompleted: () => void;
  isSheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

const CompletedTasksContext = createContext<CompletedTasksContextValue | null>(
  null,
);

export function CompletedTasksProvider({ children }: { children: ReactNode }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Background prefetch the sheet component to eliminate interaction latency
  React.useEffect(() => {
    import("@/components/tasks/CompletedTasksSheet");
  }, []);

  const toggleShowCompleted = useCallback(() => {
    setShowCompleted((prev) => !prev);
  }, []);

  const openSheet = useCallback(() => setIsSheetOpen(true), []);
  const closeSheet = useCallback(() => setIsSheetOpen(false), []);

  const value = useMemo(
    () => ({
      showCompleted,
      toggleShowCompleted,
      isSheetOpen,
      openSheet,
      closeSheet,
    }),
    [showCompleted, toggleShowCompleted, isSheetOpen, openSheet, closeSheet],
  );

  return (
    <CompletedTasksContext.Provider value={value}>
      {children}
      <CompletedTasksSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} />
    </CompletedTasksContext.Provider>
  );
}

export function useCompletedTasks() {
  const context = useContext(CompletedTasksContext);
  if (!context) {
    throw new Error(
      "useCompletedTasks must be used within a CompletedTasksProvider",
    );
  }
  return context;
}
