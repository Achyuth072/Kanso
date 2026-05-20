"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

interface UseTasksOptions {
  projectId?: string | null;
  showCompleted?: boolean;
  filter?: string;
}

export function useTasks(options: UseTasksOptions = {}) {
  const { projectId, showCompleted = false, filter } = options;
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["tasks", { projectId, showCompleted, filter, isGuestMode }],
    staleTime: 60000,
    queryFn: async (): Promise<Task[]> => {
      // Guest Mode: Use mock store
      if (isGuestMode) {
        let tasks = mockStore.getTasks();

        // Apply filters
        if (filter === "today") {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          tasks = tasks.filter(
            (t) => t.due_date && new Date(t.due_date) <= today,
          );
        } else if (filter === "p1") {
          tasks = tasks.filter((t) => t.priority === 1);
        }

        // Filter by project
        if (projectId === "inbox") {
          tasks = tasks.filter((t) => !t.project_id);
        } else if (projectId === "all") {
          const archivedProjectIds = new Set(
            mockStore
              .getProjects()
              .filter((p) => p.is_archived)
              .map((p) => p.id),
          );
          tasks = tasks.filter(
            (t) => !t.project_id || !archivedProjectIds.has(t.project_id),
          );
        } else if (projectId) {
          tasks = tasks.filter((t) => t.project_id === projectId);
        }

        // Filter completed (but keep today's completed for continuity)
        if (!showCompleted) {
          tasks = tasks.filter((t) => {
            if (!t.is_completed) return true;
            if (!t.completed_at) return false;
            const completedDate = new Date(t.completed_at);
            const today = new Date();
            return (
              completedDate.getDate() === today.getDate() &&
              completedDate.getMonth() === today.getMonth() &&
              completedDate.getFullYear() === today.getFullYear()
            );
          });
        }

        // Exclude subtasks and sort
        tasks = tasks
          .filter((t) => !t.parent_id)
          .sort((a, b) => a.day_order - b.day_order);

        return tasks;
      }

      // Normal Supabase flow
      const supabase = createClient();
      let query = supabase
        .from("tasks")
        .select(
          `
          *,
          projects!left(is_archived)
        `,
        )
        .is("parent_id", null) // Exclude subtasks from main list
        .order("day_order", { ascending: true })
        .order("created_at", { ascending: false });

      // Apply Quick Filters
      if (filter === "today") {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        query = query.lte("due_date", today.toISOString());
      } else if (filter === "p1") {
        query = query.eq("priority", 1);
      }

      // Filter by project
      if (projectId === "inbox") {
        // Inbox: Only tasks without a project
        query = query.is("project_id", null);
      } else if (projectId && projectId !== "all") {
        // Specific project: Only tasks in that project
        query = query.eq("project_id", projectId);
      }
      // "all" doesn't filter at the database level so we can catch unassigned tasks too

      if (!showCompleted) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        query = query.or(
          `is_completed.eq.false,completed_at.gte.${todayStart.toISOString()}`,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      let tasks = data as (Task & {
        projects: { is_archived: boolean } | null;
      })[];

      // Filter out tasks from archived projects for "All Tasks" view
      if (projectId === "all" || !projectId) {
        tasks = tasks.filter((t) => !t.projects?.is_archived);
      }

      return tasks;
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useTask(taskId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["task", taskId, isGuestMode],
    queryFn: async (): Promise<Task | null> => {
      if (!taskId) return null;

      // Guest Mode: Use mock store
      if (isGuestMode) {
        return mockStore.getTask(taskId);
      }

      // Normal Supabase flow
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Task;
    },
    enabled: !!taskId,
  });
}

export function useInboxProject() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["inbox-project"],
    queryFn: async () => {
      if (isGuestMode) {
        return mockStore.getProjects().find((p) => p.is_inbox) || null;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_inbox", true)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
}
