"use client";

import { memo } from "react";
import {
  CheckCircle2,
  ListFilter,
  Plus,
  LayoutGrid,
  KanbanSquare,
  List,
  ArrowUpDown,
  SquareStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GroupOption,
  SortOption,
  GROUP_LABELS,
  SORT_LABELS,
} from "@/lib/types/sorting";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { SyncIndicator } from "@/components/ui/SyncIndicator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TasksPageHeaderProps {
  currentSort: SortOption;
  currentGroup: GroupOption;
  viewMode: "list" | "grid" | "board";
  onSortChange: (sort: SortOption) => void;
  onGroupChange: (group: GroupOption) => void;
  onViewModeChange: (mode: "list" | "grid" | "board") => void;
  onNewTask?: () => void;
}

function TasksPageHeaderBase({
  currentSort,
  currentGroup,
  viewMode,
  onSortChange,
  onGroupChange,
  onViewModeChange,
  onNewTask,
}: TasksPageHeaderProps) {
  const { openSheet } = useCompletedTasks();
  const { trigger } = useHaptic();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Sort and group store writes are O(1) zustand set() calls — no transition needed.
  // The derived-state recalculation in useTaskViewData uses useMemo for memoization,
  // so wrapping these in useTransition only adds unnecessary scheduler latency
  // without any benefit.
  const handleSortChange = (sort: SortOption) => {
    onSortChange(sort);
  };

  const handleGroupChange = (group: GroupOption) => {
    onGroupChange(group);
  };

  const isFilterActive = currentSort !== "date" || currentGroup !== "none";

  return (
    <div className="flex items-center gap-3 w-full min-w-0">
      {/* Desktop only — on mobile the spinner lives in the top Header bar */}
      <span className="hidden md:flex items-center">
        <SyncIndicator />
      </span>

      <Tabs
        value={viewMode}
        onValueChange={(v) => {
          trigger("toggle");
          onViewModeChange(v as "list" | "grid" | "board");
        }}
        className="h-10"
      >
        <TabsList className="bg-secondary/10 p-1 rounded-lg h-10 border border-border/40 shadow-none">
          <TabsTrigger
            value="list"
            className="rounded-md gap-2 px-2.5 text-[13px] font-medium tracking-tight data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-all h-8 border border-transparent data-[state=active]:border-brand/20"
            title="List View (Shift+1)"
          >
            <List className="h-4 w-4" strokeWidth={2.25} />
            <span className="hidden md:inline">List</span>
          </TabsTrigger>
          {isDesktop && (
            <TabsTrigger
              value="board"
              className="rounded-md gap-2 px-2.5 text-[13px] font-medium tracking-tight data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-all h-8 border border-transparent data-[state=active]:border-brand/20"
              title="Board View (Shift+2)"
            >
              <KanbanSquare className="h-4 w-4" strokeWidth={2.25} />
              <span className="hidden md:inline">Board</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="grid"
            className="rounded-md gap-2 px-2.5 text-[13px] font-medium tracking-tight data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:shadow-none transition-all h-8 border border-transparent data-[state=active]:border-brand/20"
            title="Grid View (Shift+3)"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
            <span className="hidden md:inline">Grid</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        className={cn(
          "flex items-center h-10 bg-secondary/10 hover:bg-secondary/15 border border-border/40 transition-colors duration-100 shadow-none min-w-0",
          isFilterActive
            ? "pl-1 pr-1.5 rounded-lg"
            : "w-10 justify-center rounded-lg",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "p-0 hover:bg-foreground/5 shrink-0 transition-colors h-8 w-8 rounded-md",
                !isFilterActive && "hover:bg-transparent",
              )}
              onPointerDown={() => trigger("toggle")}
            >
              <ListFilter
                className={cn(
                  "h-4 w-4",
                  isFilterActive ? "text-brand" : "text-foreground/70",
                )}
                strokeWidth={2.25}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentSort}
              onValueChange={(v) => handleSortChange(v as SortOption)}
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  onClick={() => trigger("toggle")}
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Group By</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentGroup}
              onValueChange={(v) => handleGroupChange(v as GroupOption)}
            >
              {Object.entries(GROUP_LABELS).map(([value, label]) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  onClick={() => trigger("toggle")}
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {isFilterActive && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 pl-1.5 pr-1.5 animate-in fade-in duration-150 flex-nowrap"
            style={{
              touchAction: "pan-x",
              overscrollBehaviorX: "contain",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div className="w-[1px] h-3.5 bg-border/40 shrink-0" />

            {currentSort !== "date" && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/5 text-[13px] font-medium text-foreground/90 shrink-0">
                <ArrowUpDown
                  className="h-3.5 w-3.5 opacity-60 shrink-0"
                  strokeWidth={2.5}
                />
                <span className="whitespace-nowrap">
                  {SORT_LABELS[currentSort]}
                </span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    trigger("toggle");
                    handleSortChange("date");
                  }}
                  className="hover:bg-foreground/10 rounded-sm p-0.5 transition-colors shrink-0 ml-0.5"
                >
                  <Plus
                    className="h-3.5 w-3.5 rotate-45 opacity-50"
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            )}

            {currentGroup !== "none" && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/5 text-[13px] font-medium text-foreground/90 shrink-0">
                <SquareStack
                  className="h-3.5 w-3.5 opacity-60 shrink-0"
                  strokeWidth={2.5}
                />
                <span className="whitespace-nowrap">
                  {GROUP_LABELS[currentGroup]}
                </span>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    trigger("toggle");
                    handleGroupChange("none");
                  }}
                  className="hover:bg-foreground/10 rounded-sm p-0.5 transition-colors shrink-0 ml-0.5"
                >
                  <Plus
                    className="h-3.5 w-3.5 rotate-45 opacity-50"
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={openSheet}
        className="hidden md:flex h-9 items-center gap-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border px-3 text-[13px] font-medium"
      >
        <CheckCircle2
          className="h-4 w-4 text-foreground/70"
          strokeWidth={2.25}
        />
        <span>Completed</span>
      </Button>

      <Button
        size="sm"
        onClick={onNewTask}
        className="hidden md:flex h-9 items-center gap-2 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku shrink-0 px-4 text-[13px] font-semibold"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        <span>New Task</span>
      </Button>
    </div>
  );
}

export const TasksPageHeader = memo(TasksPageHeaderBase);
