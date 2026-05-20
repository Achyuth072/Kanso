"use client";

import { useMemo } from "react";
import {
  compareAsc,
  parseISO,
  isBefore,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";
import type { Task, Project } from "@/lib/types/task";
import type { SortOption, GroupOption } from "@/lib/types/sorting";

interface useTaskViewDataProps {
  tasks: Task[] | undefined;
  sortBy: SortOption;
  groupBy: GroupOption;
  projects?: Project[];
}

export interface TaskGroup {
  title: string;
  tasks: Task[];
}

export interface ProcessedTasks {
  active: Task[];
  completed: Task[];
  evening: Task[];
  groups: TaskGroup[] | null;
}

export function useTaskViewData({
  tasks,
  sortBy,
  groupBy,
  projects,
}: useTaskViewDataProps): ProcessedTasks {
  return useMemo(() => {
    if (!tasks) return { active: [], completed: [], evening: [], groups: null };

    const tasksToProcess = tasks;

    const completed: Task[] = [];
    const active: Task[] = [];
    const evening: Task[] = [];
    const allActive: Task[] = [];

    // Grouping state
    const groupMap: Record<string, Task[]> = {};
    const groupOrder: string[] = [];

    // 0. Pre-map projects for O(1) lookup in the loop
    const projectsMap = new Map<string, Project>();
    if (projects) {
      for (let i = 0; i < projects.length; i++) {
        projectsMap.set(projects[i].id, projects[i]);
      }
    }

    // Initialize groups if needed
    if (groupBy === "priority") {
      const labels: Record<number, string> = {
        1: "Critical",
        2: "High",
        3: "Medium",
        4: "Low",
      };
      [1, 2, 3, 4].forEach((p) => {
        const key = labels[p as 1 | 2 | 3 | 4];
        groupMap[key] = [];
        groupOrder.push(key);
      });
    } else if (groupBy === "date") {
      groupOrder.push("Overdue", "Today", "Tomorrow", "Upcoming", "No Date");
      groupOrder.forEach((k) => (groupMap[k] = []));
    }

    const today = startOfDay(new Date());

    // Pre-parse dates once in a separate map to avoid O(N log N) parseISO calls during sort
    const dateCache = new Map<string, Date>();
    const getParsedDate = (task: Task) => {
      const dateStr = task.do_date || task.due_date;
      if (!dateStr) return null;
      let date = dateCache.get(dateStr);
      if (!date) {
        date = parseISO(dateStr);
        dateCache.set(dateStr, date);
      }
      return date;
    };

    // Single-pass O(N) loop
    for (let i = 0; i < tasksToProcess.length; i++) {
      const task = tasksToProcess[i];

      const completedAtDate = task.completed_at
        ? parseISO(task.completed_at)
        : null;
      const isCompletedToday =
        task.is_completed && completedAtDate && isToday(completedAtDate);

      if (task.is_completed) {
        if (!isCompletedToday) {
          completed.push(task);
          continue;
        }
      }

      allActive.push(task);
      if (task.is_evening) {
        evening.push(task);
      } else {
        active.push(task);
      }

      // Grouping logic in the same pass
      if (groupBy === "priority") {
        const labels: Record<number, string> = {
          1: "Critical",
          2: "High",
          3: "Medium",
          4: "Low",
        };
        const key = labels[task.priority];
        groupMap[key].push(task);
      } else if (groupBy === "date") {
        const date = getParsedDate(task);
        if (!date) {
          groupMap["No Date"].push(task);
        } else {
          if (isBefore(date, today)) groupMap["Overdue"].push(task);
          else if (isToday(date)) groupMap["Today"].push(task);
          else if (isTomorrow(date)) groupMap["Tomorrow"].push(task);
          else groupMap["Upcoming"].push(task);
        }
      } else if (groupBy === "project") {
        const projectId = task.project_id || "inbox";
        const project = projectsMap.get(projectId);
        const title =
          project?.name || (projectId === "inbox" ? "Inbox" : projectId);

        if (!groupMap[title]) {
          groupMap[title] = [];
          groupOrder.push(title);
        }
        groupMap[title].push(task);
      }
    }

    // Sorting Helper - uses the pre-parsed dates from dateCache indirectly
    const sortFn = (a: Task, b: Task) => {
      if (sortBy === "custom") return 0;

      if (sortBy === "priority") {
        const diff = a.priority - b.priority;
        if (diff !== 0) return diff;
      }

      if (sortBy === "date" || sortBy === undefined) {
        const aDate = getParsedDate(a);
        const bDate = getParsedDate(b);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        const diff = compareAsc(aDate, bDate);
        if (diff !== 0) return diff;
      }

      if (sortBy === "alphabetical") {
        return a.content.localeCompare(b.content);
      }

      // Fallback: Default date sort if no other sort applies
      const aDate = getParsedDate(a);
      const bDate = getParsedDate(b);
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return compareAsc(aDate, bDate);
    };

    // Only sort if needed
    if (sortBy !== "custom") {
      active.sort(sortFn);
      evening.sort(sortFn);
      allActive.sort(sortFn);

      // Sort tasks within groups as well
      if (groupBy !== "none") {
        for (const key of groupOrder) {
          groupMap[key].sort(sortFn);
        }
      }
    }

    const finalGroups =
      groupBy === "none"
        ? null
        : groupOrder
            .filter((key) => groupMap[key].length > 0)
            .map((key) => ({ title: key, tasks: groupMap[key] }));

    return { active, completed, evening, groups: finalGroups };
  }, [tasks, sortBy, groupBy, projects]);
}
