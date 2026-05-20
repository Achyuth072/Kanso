"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Flag, Moon, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";
import {
  priorityCheckboxClasses,
  formatDueDate,
  priorityTextClasses,
} from "./task-utils";
import { KanbanBoardCardButton } from "@/components/kanban";

interface BoardTaskCardProps {
  task: Task;
  project: { color: string; name: string } | undefined;
  _isDesktop: boolean;
  handleComplete: (checked: boolean) => void;
  handlePlayFocus: (e: React.MouseEvent) => void;
  onClick?: () => void;
  shouldAnimate?: boolean;
  toggleExpand?: (e: React.MouseEvent) => void;
  isExpanded?: boolean;
}

export function BoardTaskCard({
  task,
  project,
  _isDesktop,
  handleComplete,
  handlePlayFocus,
  onClick,
  shouldAnimate,
}: BoardTaskCardProps) {
  return (
    <div
      className={cn(
        "relative bg-background border border-border/80 hover:border-border transition-all cursor-pointer group/card rounded-xl overflow-hidden",
      )}
      onClick={onClick}
    >
      {/* Vertical Project Accent Bar */}
      {project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: project.color }}
        />
      )}

      <div className="flex flex-col gap-2 w-full text-left p-3 pl-4">
        {/* Header: Checkbox, Content */}
        <div className="flex items-start gap-2">
          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={task.is_completed}
              onCheckedChange={handleComplete}
              className={cn(
                priorityCheckboxClasses[task.priority as 1 | 2 | 3 | 4],
                "h-4 w-4 !rounded-sm",
              )}
            />
          </div>

          <p className="text-sm font-medium leading-tight flex-1">
            <span
              className={cn(task.is_completed && "task-ink-completed-text")}
              data-animate={shouldAnimate ? "true" : "false"}
            >
              {task.content}
            </span>
          </p>

          {!task.is_completed && (
            <div
              className={cn(
                "flex items-center h-7 ml-auto gap-1 transition-opacity",
                _isDesktop
                  ? "opacity-0 group-hover/card:opacity-100"
                  : "opacity-100",
              )}
            >
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

        {/* Metadata Row: Always visible with icons */}
        <div className="flex items-center gap-2.5 flex-wrap ml-6">
          {task.due_date && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              <Calendar className="h-3 w-3" strokeWidth={2.5} />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task.priority < 4 && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider",
                priorityTextClasses[task.priority as 1 | 2 | 3 | 4],
              )}
            >
              <Flag className="h-3 w-3" strokeWidth={2.5} />P{task.priority}
            </span>
          )}
          {task.is_evening && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/80 uppercase tracking-wider">
              <Moon className="h-3 w-3 fill-current" />
              Evening
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
