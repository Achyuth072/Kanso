"use client";

import React, { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import TaskItem from "./TaskItem";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

interface SortableListTaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
  isKeyboardSelected?: boolean;
  viewMode?: "list" | "grid" | "board";
  isDndActive?: boolean;
  // Shared props
  project?: { color: string; name: string };
  isDesktop?: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  startTimer?: (taskId: string) => void;
}

/**
 * TaskItemContent is memoized to prevent re-renders during drag operations.
 * useSortable in the parent triggers re-renders on every frame (60fps),
 * but this child will only re-render if its props actually change.
 */
const TaskItemContent = memo(
  ({
    task,
    onSelect,
    isKeyboardSelected,
    viewMode,
    attributes,
    listeners,
    isDragging,
    setActivatorNodeRef,
    isDndActive,
    project,
    isDesktop,
    triggerHaptic,
    startTimer,
  }: SortableListTaskCardProps & {
    attributes: import("@dnd-kit/core").DraggableAttributes;
    listeners: import("@dnd-kit/core").DraggableSyntheticListeners | undefined;
    isDragging: boolean;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => {
    return (
      <TaskItem
        task={task}
        onSelect={onSelect}
        dragListeners={listeners}
        dragAttributes={attributes}
        isDragging={isDragging}
        isKeyboardSelected={isKeyboardSelected}
        viewMode={viewMode}
        dragActivatorRef={setActivatorNodeRef}
        isDndActive={isDndActive}
        project={project}
        isDesktop={isDesktop}
        triggerHaptic={triggerHaptic}
        startTimer={startTimer}
      />
    );
  },
  (prev, next) => {
    // Custom equality check to be extra safe during DnD re-renders
    return (
      prev.task.id === next.task.id &&
      prev.task.content === next.task.content &&
      prev.task.is_completed === next.task.is_completed &&
      prev.task.priority === next.task.priority &&
      prev.isKeyboardSelected === next.isKeyboardSelected &&
      prev.viewMode === next.viewMode &&
      prev.isDragging === next.isDragging &&
      prev.isDndActive === next.isDndActive &&
      prev.project?.color === next.project?.color &&
      prev.isDesktop === next.isDesktop
    );
  },
);

TaskItemContent.displayName = "TaskItemContent";

export default function SortableListTaskCard({
  task,
  onSelect,
  isKeyboardSelected,
  viewMode,
  isDndActive,
  project,
  isDesktop,
  triggerHaptic,
  startTimer,
}: SortableListTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
    over,
  } = useSortable({ id: task.id });

  // Determine drop indicator position
  let dropLine: "none" | "top" | "bottom" = "none";
  if (isOver && !isDragging) {
    const activeIndex = active?.data.current?.sortable?.index;
    const overIndex = over?.data.current?.sortable?.index;

    if (activeIndex !== undefined && overIndex !== undefined) {
      dropLine = activeIndex < overIndex ? "bottom" : "top";
    } else {
      dropLine = "top";
    }
  }

  const dndStyle = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
      : undefined,
    // Bug A fix: gate `transition` on transform != null. useSortable returns a
    // `transition: "transform Xms ease"` string whenever SortableContext.items
    // mutates. If left active when transform becomes null (post-drop steady
    // state), the browser animates transform from the last drag offset back to
    // translate3d(0,0,0), producing the visible "snap-back" the user reported.
    // Idiomatic dnd-kit pattern is to only apply transition while transform is
    // present. See .planning/debug/dnd-audit-2026-05-14.md for full analysis.
    transition: transform ? transition : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      className={cn(
        "relative",
        !isDndActive &&
          "transition-[background-color,border-color,opacity,box-shadow,ring,height] duration-200",
        "last:[&_[data-task-row]]:border-b-transparent",
        isDragging ? "opacity-30 z-20" : "opacity-100 z-10",
        isDragging && "will-change-transform",
        // Drop indicator line (like Kanban)
        dropLine === "top" &&
          "before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-primary before:z-[50] before:rounded-full",
        dropLine === "bottom" &&
          "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary after:z-[50] after:rounded-full",
      )}
    >
      <TaskItemContent
        task={task}
        onSelect={onSelect}
        isKeyboardSelected={isKeyboardSelected}
        viewMode={viewMode}
        attributes={attributes}
        listeners={listeners}
        isDragging={isDragging}
        setActivatorNodeRef={setActivatorNodeRef}
        isDndActive={isDndActive}
        project={project}
        isDesktop={isDesktop}
        triggerHaptic={triggerHaptic}
        startTimer={startTimer}
      />
    </div>
  );
}
