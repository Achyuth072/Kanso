import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar, Moon, Flag, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";

import {
  priorityTextClasses,
  priorityCheckboxClasses,
  formatDueDate,
  isOverdue,
} from "./task-utils";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { DragHandle } from "./DragHandle";
import { KanbanBoardCardButton } from "@/components/kanban";

interface ListTaskCardProps {
  task: Task;
  isDesktop: boolean;
  isExpanded: boolean;
  toggleExpand: (e: React.MouseEvent) => void;
  handleComplete: (checked: boolean) => void;
  handlePlayFocus: (e: React.MouseEvent) => void;
  onDeleteRequest: (e: React.MouseEvent) => void;
  project: { color: string; name: string } | undefined;
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  onHandlePointerDown?: () => void;
  onHandlePointerUp?: () => void;
  dragActivatorRef?: (element: HTMLElement | null) => void;
  shouldAnimate?: boolean;
}

export function ListTaskCard({
  task,
  isDesktop,
  isExpanded,
  toggleExpand,
  handleComplete,
  handlePlayFocus,
  onDeleteRequest,
  project,
  dragListeners,
  dragAttributes,
  onHandlePointerDown,
  onHandlePointerUp,
  dragActivatorRef,
  shouldAnimate = false,
}: ListTaskCardProps) {
  return (
    <div
      className={cn(
        "flex items-center w-full gap-2 md:gap-3 group relative bg-background border-b border-border/10 hover:bg-secondary/15 transition-all px-4 py-3 touch-manipulation",
      )}
      data-task-row
      data-testid="task-list-row"
      {...(!isDesktop ? dragAttributes : {})}
      {...(!isDesktop ? dragListeners : {})}
    >
      {/* Shodo Accent Stripe (Vertical Bar) */}
      {project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5"
          style={{ backgroundColor: project.color }}
        />
      )}

      {/* Drag Handle: Desktop only */}
      {isDesktop && (
        <DragHandle
          ref={dragActivatorRef}
          dragListeners={dragListeners}
          dragAttributes={dragAttributes}
          variant="desktop"
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          className="ml-1"
        />
      )}

      {/* Checkbox */}
      <div
        className={cn("shrink-0", isDesktop ? "pt-0" : "pt-0.5 p-3 -ml-3")}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={handleComplete}
          className={cn(
            priorityCheckboxClasses[task.priority as 1 | 2 | 3 | 4],
            isDesktop ? "h-4 w-4 !rounded-sm" : "h-5 w-5 !rounded-md",
          )}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 ml-1">
        {/* Title row */}
        <div className="flex items-center gap-2 min-w-0">
          <p className="type-body font-medium leading-tight truncate flex-1 min-w-0">
            <span
              className={cn(task.is_completed && "task-ink-completed-text")}
              data-animate={shouldAnimate}
            >
              {task.content}
            </span>
          </p>

          {/* Mobile Expand Toggle */}
          {!isDesktop && (
            <div className="ml-auto flex items-center shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                className="h-11 w-11 text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center justify-center -mr-1"
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-all duration-200",
                    isExpanded && "rotate-90 text-brand",
                  )}
                  strokeWidth={2.5}
                />
              </Button>

              <KanbanBoardCardButton
                onClick={handlePlayFocus}
                className="h-11 w-11 text-muted-foreground/40 hover:text-brand-foreground hover:bg-brand hover:shadow-brand/10 border-none transition-seijaku flex items-center justify-center p-0 -mr-2"
                tooltip="Start focus timer"
              >
                <Play className="h-4 w-4 fill-current" strokeWidth={2.25} />
              </KanbanBoardCardButton>
            </div>
          )}
        </div>

        {/* Metadata Row: Always below title now for unity */}
        {(task.due_date || task.priority < 4 || project) && (
          <div className="flex items-center gap-3 mt-0.5 ml-[2px] mb-1">
            {task.due_date && (
              <span
                className={cn(
                  "type-ui flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider",
                  isOverdue(task.due_date)
                    ? "text-foreground font-bold"
                    : "text-muted-foreground/70",
                )}
              >
                <Calendar className="h-3 w-3" strokeWidth={2.5} />
                {formatDueDate(task.due_date)}
              </span>
            )}
            {task.priority < 4 && (
              <span
                className={cn(
                  "type-ui flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider",
                  priorityTextClasses[task.priority as 1 | 2 | 3 | 4],
                )}
              >
                <Flag className="h-3 w-3" strokeWidth={2.5} />P{task.priority}
              </span>
            )}
            {task.is_evening && (
              <span className="type-ui flex items-center gap-1.5 text-[11px] font-medium text-foreground/80 uppercase tracking-wider">
                <Moon className="h-3 w-3 fill-current" strokeWidth={2.5} />
                Evening
              </span>
            )}

            {/* Expand Toggle Desktop */}
            {isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                className={cn(
                  "h-6 w-6 text-muted-foreground hover:text-foreground transition-colors ml-1",
                  isExpanded && "text-brand",
                )}
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-all duration-200",
                    isExpanded && "rotate-90",
                  )}
                  strokeWidth={2.5}
                />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Desktop End-cap Actions */}
      {isDesktop && (
        <div className="flex items-center h-7 gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteRequest}
            className="h-7 w-7 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.5} />
          </Button>

          <KanbanBoardCardButton
            onClick={handlePlayFocus}
            className="h-7 w-7 text-muted-foreground/40 hover:text-brand-foreground hover:bg-brand hover:shadow-brand/10 border-none transition-seijaku"
            tooltip="Start focus timer"
          >
            <Play className="h-3.5 w-3.5 fill-current" strokeWidth={2.25} />
          </KanbanBoardCardButton>
        </div>
      )}
    </div>
  );
}
