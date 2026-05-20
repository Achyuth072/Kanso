"use client";

import { useState, useCallback, memo } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { TaskDetailPanel } from "./TaskDetailPanel";
import TaskList from "./TaskList";
import type { Task } from "@/lib/types/task";
import type { SortOption, GroupOption } from "@/lib/types/sorting";

interface SplitViewLayoutProps {
  sortBy?: SortOption;
  groupBy?: GroupOption;
  projectId?: string;
  filter?: string;
}

function SplitViewLayoutBase({
  sortBy = "date",
  groupBy = "none",
  projectId,
  filter,
}: SplitViewLayoutProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { trigger } = useHaptic();

  const handleTaskSelect = useCallback(
    (task: Task) => {
      trigger("toggle"); // Toggle haptic for selection
      setSelectedTask(task);
    },
    [trigger],
  );

  const handleCloseDetail = useCallback(() => {
    trigger("tick"); // Tick haptic for close
    setSelectedTask(null);
  }, [trigger]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="w-[60%] h-full overflow-hidden">
        <TaskList
          sortBy={sortBy}
          groupBy={groupBy}
          projectId={projectId}
          filter={filter}
          onTaskSelect={handleTaskSelect}
        />
      </div>

      <div className="w-[40%] h-full overflow-hidden p-4 md:p-6 lg:p-8">
        <div className="h-full w-full rounded-2xl border border-border bg-background/50 overflow-hidden shadow-sm">
          <TaskDetailPanel task={selectedTask} onClose={handleCloseDetail} />
        </div>
      </div>
    </div>
  );
}

export const SplitViewLayout = memo(SplitViewLayoutBase);
