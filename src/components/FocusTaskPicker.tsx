"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";
import { useTimerStore } from "@/lib/store/timerStore";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { Target, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

/**
 * Focus Task Picker
 *
 * Tappable chip showing the active focus task (or "Add task" placeholder).
 * Opens a task picker — Drawer on mobile, Dialog on desktop — showing
 * today's tasks and overdue tasks. Task selection respects the
 * taskSwitchBehavior setting (keepRunning / pauseOnSwitch / resetOnSwitch).
 *
 * Per UI-SPEC TASK-CHIP-01 and TASK-PICKER-01/02.
 */

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FocusTaskPicker() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();
  const supabase = createClient();

  // Timer store selectors
  const activeTaskId = useTimerStore((s) => s.state.activeTaskId);
  const isRunning = useTimerStore((s) => s.state.isRunning);
  const taskSwitchBehavior = useTimerStore(
    (s) => s.settings.taskSwitchBehavior,
  );
  const pause = useTimerStore((s) => s.pause);
  const cancel = useTimerStore((s) => s.cancel);
  const setActiveTaskId = useTimerStore((s) => s.setActiveTaskId);

  // Guest-mode fallback for active task detail (sync lookup, no network)
  const guestActiveTask: Task | null = useMemo(() => {
    if (!isGuestMode || !activeTaskId) return null;
    const all = mockStore.getTasks();
    return all.find((t) => t.id === activeTaskId) ?? null;
  }, [isGuestMode, activeTaskId]);

  // Fetch active task details (disabled for guest mode — guestActiveTask handles it)
  const { data: activeTask, isLoading: activeTaskLoading } = useQuery({
    queryKey: ["task", activeTaskId, isGuestMode],
    queryFn: async () => {
      if (!activeTaskId) return null;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", activeTaskId)
        .single();
      return data as Task | null;
    },
    enabled: !!activeTaskId && !isGuestMode,
  });

  // Resolve active task: guest uses local memo, authed uses Supabase query
  const resolvedActiveTask = isGuestMode ? guestActiveTask : activeTask;
  const resolvedActiveTaskLoading = isGuestMode ? false : activeTaskLoading;

  // Fetch today's tasks + overdue for the picker (only when open)
  const today = useMemo(() => getTodayString(), []);

  const { data: pickerTasks, isLoading: pickerLoading } = useQuery({
    queryKey: ["focus-tasks", today, isGuestMode],
    queryFn: async () => {
      if (isGuestMode) {
        const all = mockStore.getTasks();
        const todayTasks = all.filter((t) => t.do_date === today);
        const overdueTasks = all.filter(
          (t) => t.do_date && t.do_date < today,
        );
        const combined = [...todayTasks, ...overdueTasks];
        const seen = new Set<string>();
        return combined.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      }
      const todayStr = today;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .in("do_date", [todayStr])
        .order("day_order", { ascending: true });
      // Also fetch overdue tasks
      const { data: overdue } = await supabase
        .from("tasks")
        .select("*")
        .lt("do_date", todayStr)
        .order("day_order", { ascending: true });
      const combined = [...(data || []), ...(overdue || [])];
      // Deduplicate by id
      const seen = new Set<string>();
      return combined.filter((t: Task) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }) as Task[];
    },
    enabled: open,
  });

  // Chip tap handler — opens the picker
  const handleChipTap = useCallback(() => {
    trigger("toggle");
    setOpen(true);
  }, [trigger]);

  // Task selection handler
  const handleSelectTask = useCallback(
    (task: Task) => {
      trigger("toggle");

      // Apply taskSwitchBehavior
      switch (taskSwitchBehavior) {
        case "pauseOnSwitch":
          pause();
          break;
        case "resetOnSwitch":
          cancel();
          break;
        case "keepRunning":
        default:
          // Keep timer running — just update activeTaskId
          break;
      }

      // Set the new active task
      setActiveTaskId(task.id);

      // Close picker
      setOpen(false);

      // Show confirmation toast
      toast("Now focusing on " + task.content);
    },
    [taskSwitchBehavior, pause, cancel, setActiveTaskId, trigger],
  );

  // Back navigation for mobile drawer
  useBackNavigation(open && !isDesktop, () => setOpen(false));

  // Chip ARIA label
  const chipLabel = resolvedActiveTask
    ? `Change focus task: ${resolvedActiveTask?.content || ""}`
    : "Select focus task";

  // Task list rendering
  const renderTaskList = () => {
    if (pickerLoading) {
      return (
        <div className="space-y-3 py-4 px-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
        </div>
      );
    }

    const tasks = pickerTasks || [];

    if (tasks.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            Nothing due today
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            Tasks scheduled for today will appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="py-2">
        {tasks.map((task: Task) => {
          const isActive = task.id === activeTaskId;
          const isCompleted = task.is_completed;

          return (
            <button
              key={task.id}
              data-testid="task-row"
              type="button"
              disabled={isCompleted}
              onClick={() => !isCompleted && handleSelectTask(task)}
              className={cn(
                "w-full flex items-center gap-3 py-3 px-4 text-left transition-colors duration-100",
                isActive && "bg-brand/8",
                isCompleted && "opacity-40 pointer-events-none",
                !isCompleted &&
                  !isActive &&
                  "hover:bg-secondary/40 cursor-pointer",
              )}
              role="option"
              aria-selected={isActive}
            >
              {/* Project color stripe */}
              <div
                className={cn(
                  "w-1 h-8 rounded-full shrink-0",
                  task.project_id ? "bg-brand/40" : "bg-transparent",
                )}
              />

              {/* Task content */}
              <span
                className={cn(
                  "flex-1 text-[15px] font-normal truncate",
                  isCompleted && "line-through",
                )}
              >
                {task.content}
              </span>

              {/* Active indicator */}
              {isActive && (
                <Check
                  className="h-3.5 w-3.5 text-brand shrink-0"
                  strokeWidth={2.25}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // Picker content (shared between Dialog and Drawer)
  const pickerContent = (
    <div>
      {renderTaskList()}
    </div>
  );

  return (
    <>
      {/* Task Chip */}
      <div className="flex justify-center mt-4 mb-0">
        <motion.button
          onClick={handleChipTap}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-2 min-h-[32px] max-w-[240px] truncate transition-colors duration-150 cursor-pointer",
            resolvedActiveTask
              ? "bg-secondary/40 border border-border/60 hover:bg-secondary/60 hover:border-brand/40"
              : "border-dashed border-border/60 bg-transparent hover:bg-secondary/40 hover:border-brand/40",
          )}
          role="button"
          aria-label={chipLabel}
        >
          <Target
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            strokeWidth={2.25}
          />
          {resolvedActiveTaskLoading ? (
            <span className="text-[13px] text-muted-foreground/60">
              Loading...
            </span>
          ) : resolvedActiveTask ? (
            <span className="text-body text-foreground truncate text-[15px]">
              {resolvedActiveTask.content}
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground/60">
              Add task
            </span>
          )}
        </motion.button>
      </div>

      {/* Desktop: Dialog */}
      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Focus on...</DialogTitle>
            </DialogHeader>
            {pickerContent}
          </DialogContent>
        </Dialog>
      ) : (
        /* Mobile: Drawer */
        <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader>
              <DrawerTitle>Focus on...</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">{pickerContent}</div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
