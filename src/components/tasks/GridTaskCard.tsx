"use client";

import React, { memo, useState, useCallback, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  PanInfo,
} from "framer-motion";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { useToggleTask } from "@/lib/hooks/useTaskMutations";
import { Play, Calendar, Flag, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  priorityCheckboxClasses,
  formatDueDate,
  priorityTextClasses,
} from "./task-utils";
import { useRouter } from "next/navigation";
import { KanbanBoardCardButton } from "@/components/kanban";

const SWIPE_THRESHOLD = 150;

interface GridTaskCardProps {
  task: Task;
  project?: { color: string; name: string } | null;
  onSelect?: (task: Task) => void;
  isDesktop: boolean;
  triggerHaptic?: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  setActiveTaskId?: (taskId: string) => void;
  toggleExpand?: (e: React.MouseEvent) => void;
  isExpanded?: boolean;
  shouldAnimate?: boolean;
}

export const GridTaskCard = memo(function GridTaskCard({
  task,
  project,
  onSelect,
  isDesktop,
  triggerHaptic,
  setActiveTaskId,
  shouldAnimate: initialShouldAnimate = false,
}: GridTaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(initialShouldAnimate);
  const toggleMutation = useToggleTask();
  const x = useMotionValue(0);
  const router = useRouter();
  const handleComplete = useCallback(() => {
    if (isCompleting) return;
    setIsCompleting(true);
    const nextStatus = !task.is_completed;
    // Only animate when user actively completes the task
    if (nextStatus) {
      setShouldAnimate(true);
      setTimeout(() => setShouldAnimate(false), 1000);
    } else {
      setShouldAnimate(false);
    }
    setTimeout(() => {
      toggleMutation.mutate(
        { id: task.id, is_completed: nextStatus },
        {
          onSettled: () => setIsCompleting(false),
        },
      );
    }, 250);
  }, [isCompleting, task.id, task.is_completed, toggleMutation]);

  const handlePlayFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic?.("thud");
    setActiveTaskId?.(task.id);
    router.push("/focus");
  };

  const handleDesktopComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic?.("success");
    handleComplete();
  };

  const handleDragEnd = (
    e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (info.offset.x > SWIPE_THRESHOLD && !isCompleting) {
      triggerHaptic?.("success");
      handleComplete();
    } else if (info.offset.x < -SWIPE_THRESHOLD && !task.is_completed) {
      triggerHaptic?.("thud");
      setActiveTaskId?.(task.id);
      router.push("/focus");
    }
  };

  const lastTickRef = useRef(0);
  const handleDrag = (
    e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const currentX = info.offset.x;
    if (
      Math.abs(currentX) > Math.abs(lastTickRef.current) + 30 &&
      Math.abs(currentX) < SWIPE_THRESHOLD
    ) {
      triggerHaptic?.("tick");
      lastTickRef.current = currentX;
    } else if (Math.abs(currentX) < Math.abs(lastTickRef.current) - 30) {
      lastTickRef.current = currentX;
    }
  };

  const handleDragStart = () => {
    lastTickRef.current = 0;
  };

  const completeBgOpacity = useTransform(x, [0, 5, 25, 30], [0, 0.1, 1, 1]);
  const playBgOpacity = useTransform(x, [-30, -25, -5, 0], [1, 1, 0.1, 0]);

  const completeIconScale = useTransform(x, [0, 25], [0.5, 1]);
  const playIconScale = useTransform(x, [-25, 0], [1, 0.5]);

  const completeIconOpacity = useTransform(x, [5, 20], [0, 1]);
  const playIconOpacity = useTransform(x, [-20, -5], [1, 0]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          type: "spring",
          mass: 1,
          stiffness: 280,
          damping: 60,
        }}
        className={cn(
          "group relative bg-background border border-border rounded-xl overflow-hidden cursor-pointer",
          isDesktop &&
            "hover:border-foreground/20 hover:bg-secondary/5 transition-seijaku",
        )}
        onClick={() => onSelect?.(task)}
      >
        {/* Shodo Accent Stripe */}
        {project && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 z-20"
            style={{ backgroundColor: project.color }}
          />
        )}
        {isDesktop ? (
          <div className="flex flex-col gap-3 p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-0.5 flex-1 min-w-0">
                <h4
                  className={cn(
                    "text-[15px] font-medium leading-relaxed transition-colors",
                  )}
                >
                  <span
                    className={cn(
                      task.is_completed && "task-ink-completed-text",
                    )}
                    data-animate={shouldAnimate ? "true" : "false"}
                  >
                    {task.content}
                  </span>
                </h4>
              </div>
            </div>

            <div className="flex items-center h-7 gap-1.5 opacity-0 group-hover:opacity-100 transition-seijaku-fast absolute top-6 right-6">
              <KanbanBoardCardButton
                onClick={handlePlayFocus}
                className="h-7 w-7 text-muted-foreground/40 hover:text-brand-foreground hover:bg-brand hover:shadow-brand/10 border-none transition-seijaku"
                tooltip="Start focus timer"
              >
                <Play className="h-3.5 w-3.5 fill-current" strokeWidth={2.25} />
              </KanbanBoardCardButton>

              <div
                className="h-7 w-7 flex items-center justify-center -mr-1"
                onClick={handleDesktopComplete}
              >
                <Checkbox
                  checked={task.is_completed || isCompleting}
                  className={cn(
                    priorityCheckboxClasses[task.priority as 1 | 2 | 3 | 4],
                    "h-4 w-4 !rounded-sm pointer-events-none",
                  )}
                />
              </div>
            </div>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Footer: Always visible metadata */}
            <div className="flex items-center gap-3 flex-wrap min-h-4">
              {task.priority < 4 && (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider",
                    priorityTextClasses[task.priority as 1 | 2 | 3 | 4],
                  )}
                >
                  <Flag className="h-2.5 w-2.5" strokeWidth={2.5} />P
                  {task.priority}
                </span>
              )}
              {task.due_date && (
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {task.is_evening && (
                <span className="text-[11px] text-foreground font-semibold uppercase tracking-wider leading-none">
                  Evening
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-brand flex items-center pl-4"
              style={{ opacity: completeBgOpacity }}
            >
              <motion.div
                style={{
                  scale: completeIconScale,
                  opacity: completeIconOpacity,
                }}
              >
                <Check className="text-white h-5 w-5" strokeWidth={2.25} />
              </motion.div>
            </motion.div>

            <motion.div
              className="absolute inset-0 bg-zinc-800 flex items-center justify-end pr-4"
              style={{ opacity: playBgOpacity }}
            >
              <motion.div
                style={{ scale: playIconScale, opacity: playIconOpacity }}
              >
                <Play
                  className="text-white h-5 w-5 fill-current"
                  strokeWidth={2.25}
                />
              </motion.div>
            </motion.div>

            <motion.div
              className="flex flex-col gap-3 p-6 bg-background relative z-10 h-full"
              style={{ x }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{
                left: task.is_completed ? 0 : 0.2,
                right: 0.2,
              }}
              dragMomentum={false}
              dragSnapToOrigin={true}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-0.5 flex-1 min-w-0">
                  <h4
                    className={cn(
                      "text-[15px] font-medium leading-relaxed transition-colors",
                    )}
                  >
                    <span
                      className={cn(
                        task.is_completed && "task-ink-completed-text",
                      )}
                      data-animate={shouldAnimate ? "true" : "false"}
                    >
                      {task.content}
                    </span>
                  </h4>
                </div>
              </div>

              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-3 flex-wrap min-h-4">
                {task.priority < 4 && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider",
                      priorityTextClasses[task.priority as 1 | 2 | 3 | 4],
                    )}
                  >
                    <Flag className="h-2.5 w-2.5" strokeWidth={2.5} />P
                    {task.priority}
                  </span>
                )}
                {task.due_date && (
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                {task.is_evening && (
                  <span className="text-[11px] text-foreground font-semibold uppercase tracking-wider leading-none">
                    Evening
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});
