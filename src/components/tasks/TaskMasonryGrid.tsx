"use client";

import React, { useMemo } from "react";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";
import { Masonry } from "@/components/ui/Masonry";
import { TaskItem } from "./TaskItem";

interface TaskMasonryGridProps {
  processedTasks: ProcessedTasks;
  projectsMap: Map<string, Project>;
  onSelect?: (task: Task) => void;
  isDesktop: boolean;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  startTimer: (taskId: string) => void;
}

export function TaskMasonryGrid({
  processedTasks,
  projectsMap = new Map(),
  onSelect,
  isDesktop,
  triggerHaptic,
  startTimer,
}: TaskMasonryGridProps) {
  const { active, evening, groups, completed } = processedTasks;

  // Flatten keeping the processed order (groups or flat)
  const allNavigableTasks = useMemo(() => {
    const list: Task[] = [];
    if (groups) {
      groups.forEach((g) => list.push(...g.tasks));
    } else {
      list.push(...active);
      // Add evening tasks at the end of the active set ONLY if not grouped (where they are included)
      list.push(...evening);
    }

    // Add completed repeated tasks (UX-P03 requirement)
    const completedRepeated = completed.filter((t) => t.recurrence !== null);
    list.push(...completedRepeated);

    return list;
  }, [active, evening, groups, completed]);

  if (allNavigableTasks.length === 0) {
    return (
      <div className="px-4 md:px-6 py-12 text-center text-muted-foreground">
        No active tasks to display in grid.
      </div>
    );
  }

  // Use "16px" (gap=4) for mobile, larger gap (gap=6) for desktop grid masonry
  const gap = isDesktop ? 6 : 4;

  return (
    <div
      className="px-4 md:px-6 pb-12 md:pb-8"
      data-testid="task-grid-container"
    >
      <Masonry
        gap={gap}
        items={allNavigableTasks}
        getItemId={(task) => task.id}
        renderItem={(task) => {
          const project = projectsMap?.get?.(task.project_id || "inbox");
          return (
            <TaskItem
              key={task.id}
              task={task}
              project={
                project
                  ? { color: project.color, name: project.name }
                  : undefined
              }
              onSelect={onSelect}
              isDesktop={isDesktop}
              triggerHaptic={triggerHaptic}
              startTimer={startTimer}
              viewMode="grid"
            />
          );
        }}
      />
    </div>
  );
}
