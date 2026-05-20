"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import TaskList from "@/components/tasks/TaskList";
import { format } from "date-fns";
import { TasksPageHeader } from "@/components/tasks/TasksPageHeader";
import { useUiStore } from "@/lib/store/uiStore";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { PlusIcon } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { SplitViewLayout } from "@/components/tasks/SplitViewLayout";
import type { SortOption, GroupOption } from "@/lib/types/sorting";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortBy = useUiStore((state) => state.sortBy);
  const groupBy = useUiStore((state) => state.groupBy);
  const viewMode = useUiStore((state) => state.viewMode);
  const setSortBy = useUiStore((state) => state.setSortBy);
  const setGroupBy = useUiStore((state) => state.setGroupBy);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const { openAddTask } = useTaskActions();
  const { trigger } = useHaptic();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [isTaskListPending, startTransition] = useTransition();

  const handleSortChange = (sort: SortOption) => {
    startTransition(() => {
      setSortBy(sort);
    });
  };

  const handleGroupChange = (group: GroupOption) => {
    startTransition(() => {
      setGroupBy(group);
    });
  };

  const currentProjectId = searchParams.get("project") || "all";
  const filter = searchParams.get("filter") || undefined;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const today = new Date();
  const greeting = getGreeting();

  return (
    <div className="flex flex-col h-[calc(100dvh-124px)] md:h-[calc(100dvh-16px)] overflow-hidden">
      <div className="px-4 md:px-6 pt-4 pb-4 flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-0">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {format(today, "EEEE, MMMM d")}
            {filter && (
              <span className="flex items-center gap-1.5 before:content-['•'] before:text-muted-foreground/40">
                <span className="capitalize text-primary font-medium">
                  {filter === "p1" ? "High Priority" : filter}
                </span>
                <button
                  onClick={() => {
                    trigger("toggle");
                    router.push("/");
                  }}
                  className="bg-secondary/40 hover:bg-secondary/60 border border-border/50 p-0.5 rounded-full transition-colors"
                  title="Clear filter"
                >
                  <PlusIcon className="h-3.5 w-3.5 rotate-45" />
                </button>
              </span>
            )}
          </p>
          <h1 className="type-h1 mt-1 text-primary">{greeting}</h1>
        </div>

        <div className="flex w-full md:w-auto md:justify-end">
          <TasksPageHeader
            currentSort={sortBy}
            currentGroup={groupBy}
            viewMode={viewMode}
            onSortChange={handleSortChange}
            onGroupChange={handleGroupChange}
            onViewModeChange={setViewMode}
            onNewTask={openAddTask}
          />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 transition-opacity duration-150"
        style={{ opacity: isTaskListPending ? 0.6 : 1 }}
      >
        {/* 🚀 Performance: Conditionally render views instead of CSS hiding to prevent double-rendering TaskList instances. */}
        {viewMode === "list" && !isMobile ? (
          <SplitViewLayout
            sortBy={sortBy}
            groupBy={groupBy}
            projectId={currentProjectId}
            filter={filter}
          />
        ) : (
          <TaskList
            sortBy={sortBy}
            groupBy={groupBy}
            projectId={currentProjectId}
            filter={filter}
          />
        )}
      </div>
    </div>
  );
}
