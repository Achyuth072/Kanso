"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import TaskItem from "./TaskItem";
import SortableListTaskCard from "./SortableListTaskCard";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks, TaskGroup } from "@/lib/hooks/useTaskViewData";
import { cn } from "@/lib/utils";

/**
 * DroppableContainer is a lightweight wrapper for dnd-kit drop zones.
 * Removed the extra levels of nesting found in the previous TaskSection.
 */
function DroppableContainer({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

/**
 * SectionHeader follows the "Shodo" (typography) principles
 * without introducing complex container hierarchies.
 */
function SectionHeader({
  title,
  count,
  icon,
  variant = "default",
}: {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  variant?: "default" | "muted";
}) {
  return (
    <div className="flex items-baseline gap-2 px-1 mb-2">
      <h3
        className={cn(
          "type-h3 tracking-tight",
          variant === "muted"
            ? "text-muted-foreground/70"
            : "text-foreground/70",
        )}
      >
        {icon && <span className="mr-1.5 inline-block">{icon}</span>}
        {title}
      </h3>
      {count !== undefined && (
        <span className="type-micro text-muted-foreground font-medium">
          ({count})
        </span>
      )}
    </div>
  );
}

interface TaskListViewProps {
  processedTasks: ProcessedTasks;
  activeTasks: Task[];
  eveningTasks: Task[];
  groupTasks: TaskGroup[] | null;
  handleTaskClick: (task: Task) => void;
  keyboardSelectedId: string | null;
  isDndActive?: boolean;
  // Shared props for performance
  projectsMap: Map<string, Project>;
  isDesktop: boolean;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId: (taskId: string) => void;
}

/**
 * TaskListView rebuilt with a flat DOM hierarchy.
 * Optimized for dnd-kit performance by minimizing React reconciliation depth.
 */
export function TaskListView({
  processedTasks,
  activeTasks,
  eveningTasks,
  groupTasks,
  handleTaskClick,
  keyboardSelectedId,
  isDndActive,
  projectsMap,
  isDesktop,
  triggerHaptic,
  setActiveTaskId,
}: TaskListViewProps) {
  const { completed } = processedTasks;
  const groups = groupTasks;
  const active = activeTasks;
  const evening = eveningTasks;

  const activeIds = useMemo(() => active.map((t) => t.id), [active]);
  const eveningIds = useMemo(() => evening.map((t) => t.id), [evening]);

  return (
    <div
      className="px-4 md:px-6 pb-12 md:pb-8 flex flex-col gap-8 touch-manipulation"
      data-testid="task-list-container"
    >
      {/* 1. Grouped Tasks (Sortable) */}
      {groups &&
        groups.map((group: TaskGroup) => {
          const groupTaskIds = group.tasks.map((t: Task) => t.id);
          return (
            <section key={group.title} className="first:mt-2">
              <SectionHeader title={group.title} count={group.tasks.length} />
              <SortableContext
                id={group.title}
                items={groupTaskIds}
                strategy={verticalListSortingStrategy}
              >
                <DroppableContainer
                  id={group.title}
                  className="flex flex-col gap-0 rounded-xl border border-border bg-background/50 overflow-hidden"
                >
                  {group.tasks.map((task: Task) => {
                    const project = projectsMap?.get?.(
                      task.project_id || "inbox",
                    );
                    return (
                      <SortableListTaskCard
                        key={task.id}
                        task={task}
                        onSelect={handleTaskClick}
                        isKeyboardSelected={task.id === keyboardSelectedId}
                        isDndActive={isDndActive}
                        project={project}
                        isDesktop={isDesktop}
                        triggerHaptic={triggerHaptic}
                        setActiveTaskId={setActiveTaskId}
                      />
                    );
                  })}
                </DroppableContainer>
              </SortableContext>
            </section>
          );
        })}

      {/* 2. Active Tasks (Flat & Sortable) */}
      {!groups && (
        <section className="first:mt-2">
          <SortableContext
            id="active-section"
            items={activeIds}
            strategy={verticalListSortingStrategy}
          >
            <DroppableContainer id="active-section" className="flex flex-col">
              <div className="flex flex-col gap-0 rounded-xl border border-border bg-background/50 overflow-hidden">
                {active.map((task) => {
                  const project = projectsMap?.get?.(
                    task.project_id || "inbox",
                  );
                  return (
                    <SortableListTaskCard
                      key={task.id}
                      task={task}
                      onSelect={handleTaskClick}
                      isKeyboardSelected={task.id === keyboardSelectedId}
                      isDndActive={isDndActive}
                      project={project}
                      isDesktop={isDesktop}
                      triggerHaptic={triggerHaptic}
                      setActiveTaskId={setActiveTaskId}
                    />
                  );
                })}
              </div>
            </DroppableContainer>
          </SortableContext>
        </section>
      )}

      {/* 3. Evening Section (Sortable) */}
      {!groups && (
        <section
          className={cn(
            "transition-all duration-300",
            evening.length === 0 && "opacity-20 hover:opacity-100",
          )}
        >
          <SectionHeader
            title="This Evening"
            count={evening.length > 0 ? evening.length : undefined}
            icon="🌙"
          />
          <SortableContext
            id="evening-section"
            items={eveningIds}
            strategy={verticalListSortingStrategy}
          >
            <DroppableContainer id="evening-section" className="flex flex-col">
              <div className="flex flex-col gap-0 rounded-xl border border-border bg-background/50 overflow-hidden">
                {evening.map((task) => {
                  const project = projectsMap?.get?.(
                    task.project_id || "inbox",
                  );
                  return (
                    <SortableListTaskCard
                      key={task.id}
                      task={task}
                      onSelect={handleTaskClick}
                      isKeyboardSelected={task.id === keyboardSelectedId}
                      isDndActive={isDndActive}
                      project={project}
                      isDesktop={isDesktop}
                      triggerHaptic={triggerHaptic}
                      setActiveTaskId={setActiveTaskId}
                    />
                  );
                })}
                {evening.length === 0 && (
                  <div className="h-12 flex items-center justify-center border-2 border-dashed border-primary/10 rounded-2xl mx-1">
                    <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                      Drop here for evening
                    </span>
                  </div>
                )}
              </div>
            </DroppableContainer>
          </SortableContext>
        </section>
      )}

      {/* 4. Completed Section (Static) */}
      {completed.length > 0 && (
        <section className="mt-4">
          <SectionHeader
            title="Completed"
            count={completed.length}
            variant="muted"
          />
          <div className="flex flex-col gap-0 rounded-xl border border-border bg-background/50 overflow-hidden [&>*:last-child_[data-task-row]]:border-b-transparent">
            {completed.map((task) => {
              const project = projectsMap?.get?.(task.project_id || "inbox");
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  onSelect={handleTaskClick}
                  isKeyboardSelected={task.id === keyboardSelectedId}
                  isDndActive={isDndActive}
                  project={project}
                  isDesktop={isDesktop}
                  triggerHaptic={triggerHaptic}
                  setActiveTaskId={setActiveTaskId}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
