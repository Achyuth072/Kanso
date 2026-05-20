"use client";

import React, { useState, useMemo } from "react";
import { useTasks } from "@/lib/hooks/useTasks";
import { isToday, isYesterday, parseISO, startOfWeek, isAfter } from "date-fns";
import { CheckCircle2, Clock, Trash2, Search, X } from "lucide-react";
import { Virtuoso } from "react-virtuoso";

import type { Task } from "@/lib/types/task";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import {
  useUpdateTask,
  useClearCompletedTasks,
} from "@/lib/hooks/useTaskMutations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import { Input } from "@/components/ui/input";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";

interface CompletedTasksSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Optimized individual item to prevent re-renders of the whole list
const CompletedTaskItem = React.memo(({ task }: { task: Task }) => {
  const updateMutation = useUpdateTask();
  const { trigger } = useHaptic();

  const handleUncomplete = () => {
    trigger("toggle");
    updateMutation.mutate({ id: task.id, is_completed: false });
  };

  const { formatTime } = useTimeFormat();

  const completedDate = useMemo(
    () => (task.completed_at ? parseISO(task.completed_at) : null),
    [task.completed_at],
  );

  const formattedDate = useMemo(
    () => (completedDate ? formatTime(completedDate) : ""),
    [completedDate, formatTime],
  );

  return (
    <div className="flex items-start gap-3 py-2 md:py-2 px-4 border-b border-border/40 hover:bg-secondary/30 transition-colors group min-h-[44px]">
      <button onClick={handleUncomplete}>
        <CheckCircle2
          className="h-5 w-5 text-foreground/50 hover:text-foreground transition-colors"
          strokeWidth={2.5}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight line-through text-foreground/50">
          {task.content}
        </p>
        {completedDate && (
          <div className="flex items-center gap-1 mt-1 text-xs text-foreground/60 font-medium">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </div>
        )}
      </div>
    </div>
  );
});

CompletedTaskItem.displayName = "CompletedTaskItem";

function groupTasksByDate(tasks: Task[]) {
  const today: Task[] = [];
  const yesterday: Task[] = [];
  const thisWeek: Task[] = [];
  const older: Task[] = [];

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday

  tasks.forEach((task) => {
    if (!task.completed_at) {
      older.push(task);
      return;
    }

    const completedDate = parseISO(task.completed_at);

    if (isToday(completedDate)) {
      today.push(task);
    } else if (isYesterday(completedDate)) {
      yesterday.push(task);
    } else if (isAfter(completedDate, weekStart)) {
      thisWeek.push(task);
    } else {
      older.push(task);
    }
  });

  return { today, yesterday, thisWeek, older };
}

type FlattenedItem =
  | { type: "header"; title: string; id: string }
  | { type: "task"; task: Task; id: string };

export function CompletedTasksSheet({
  open,
  onOpenChange,
}: CompletedTasksSheetProps) {
  const { data: tasks = [], isLoading } = useTasks({ showCompleted: true });
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const clearMutation = useClearCompletedTasks();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { trigger } = useHaptic();

  useBackNavigation(open && !isDesktop, () => onOpenChange(false));

  const completedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.is_completed &&
          task.completed_at &&
          !isToday(parseISO(task.completed_at)),
      ),
    [tasks],
  );

  const filteredCompletedTasks = useMemo(
    () =>
      completedTasks.filter((task) =>
        task.content.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [completedTasks, searchQuery],
  );

  const flattenedItems = useMemo(() => {
    const { today, yesterday, thisWeek, older } = groupTasksByDate(
      filteredCompletedTasks,
    );
    const items: FlattenedItem[] = [];

    if (today.length > 0) {
      items.push({ type: "header", title: "Today", id: "header-today" });
      today.forEach((task) => items.push({ type: "task", task, id: task.id }));
    }
    if (yesterday.length > 0) {
      items.push({
        type: "header",
        title: "Yesterday",
        id: "header-yesterday",
      });
      yesterday.forEach((task) =>
        items.push({ type: "task", task, id: task.id }),
      );
    }
    if (thisWeek.length > 0) {
      items.push({ type: "header", title: "This Week", id: "header-week" });
      thisWeek.forEach((task) =>
        items.push({ type: "task", task, id: task.id }),
      );
    }
    if (older.length > 0) {
      items.push({ type: "header", title: "Older", id: "header-older" });
      older.forEach((task) => items.push({ type: "task", task, id: task.id }));
    }

    return items;
  }, [filteredCompletedTasks]);

  const isSearching = searchQuery.length > 0;
  const hasResults = flattenedItems.length > 0;

  const handleClearHistory = () => {
    setShowClearDialog(false);
    onOpenChange(false);
    clearMutation.mutate();
  };

  const renderItem = (index: number, item: FlattenedItem) => {
    if (item.type === "header") {
      return (
        <h3 className="type-micro font-semibold uppercase px-6 py-3 border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
          {item.title}
        </h3>
      );
    }
    return <CompletedTaskItem task={item.task} />;
  };

  const content = (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : completedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <CheckCircle2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Completed Tasks</h2>
          <p className="text-muted-foreground max-w-md">
            Tasks you complete will appear here. Start checking off items from
            your task list!
          </p>
        </div>
      ) : !hasResults && isSearching ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-medium mb-1">No tasks found</h2>
          <p className="text-sm text-muted-foreground">
            Try searching for something else
          </p>
        </div>
      ) : (
        <Virtuoso
          style={{ height: "100%", width: "100%" }}
          data={flattenedItems}
          itemContent={renderItem}
          className="scrollbar-hide"
          computeItemKey={(index, item) => item.id}
          initialTopMostItemIndex={0}
          overscan={200}
        />
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg h-[80vh] flex flex-col p-0 overflow-hidden border-border bg-background [&>button:last-child]:hidden">
          <DialogHeader className="flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border/50 shrink-0">
            <DialogTitle className="flex items-center gap-2 cursor-default">
              <CheckCircle2
                className="h-4 w-4 text-foreground/70"
                strokeWidth={2.5}
              />
              <span className="type-h2">Logbook</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              View and manage your completed task history.
            </DialogDescription>
            <div className="flex items-center gap-3">
              {completedTasks.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    trigger("thud");
                    setShowClearDialog(true);
                  }}
                  className="h-8 gap-2 rounded-sm shadow-none font-medium px-3"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  <span className="text-xs">Clear History</span>
                </Button>
              )}
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-foreground transition-seijaku-fast rounded-sm"
                  title="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>

          {completedTasks.length > 0 && (
            <div className="px-6 py-3 border-b border-border/40 bg-secondary/5 shrink-0">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-brand transition-colors" />
                <Input
                  className="pl-9 bg-secondary/20 border-border/40 focus:border-border/60 focus:bg-secondary/30 h-9 text-sm transition-all placeholder:text-muted-foreground/40"
                  placeholder="Search completed tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden">{content}</div>
        </DialogContent>

        <DeleteConfirmationDialog
          isOpen={showClearDialog}
          onClose={() => setShowClearDialog(false)}
          onConfirm={handleClearHistory}
          title="Clear History"
          description="Are you sure you want to delete all completed tasks? This action cannot be undone and will remove these tasks from your statistics."
        />
      </Dialog>
    );
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh] h-[92dvh] flex flex-col overflow-hidden">
          <div className="flex flex-row items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <CheckCircle2
                className="h-5 w-5 text-foreground/70"
                strokeWidth={2.5}
              />
              <span className="type-h2">Logbook</span>
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              View and manage your completed task history.
            </DrawerDescription>
            <div className="flex items-center gap-3">
              {completedTasks.length > 0 && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 active:scale-95 transition-seijaku-fast rounded-md shadow-none"
                  onClick={() => {
                    trigger("thud");
                    setShowClearDialog(true);
                  }}
                >
                  <Trash2 className="h-5 w-5" strokeWidth={2.25} />
                </Button>
              )}
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground active:scale-95 transition-seijaku-fast"
                >
                  <X className="h-6 w-6" strokeWidth={2} />
                </Button>
              </DrawerClose>
            </div>
          </div>

          {completedTasks.length > 0 && (
            <div className="px-6 py-4 border-b border-border/40 bg-secondary/5 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
                <Input
                  className="pl-11 bg-secondary/20 h-12 text-base shadow-none border-border/30 focus:border-border/60 focus:bg-secondary/30 rounded-xl transition-all"
                  placeholder="Search completed tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>

      <DeleteConfirmationDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearHistory}
        title="Clear History"
        description="Are you sure you want to delete all completed tasks? This action cannot be undone and will remove these tasks from your statistics."
      />
    </>
  );
}
