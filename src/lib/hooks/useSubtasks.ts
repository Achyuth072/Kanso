"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

/**
 * Fetches all subtasks for a given parent task.
 */
export function useSubtasks(parentId: string | null | undefined) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["subtasks", parentId, isGuestMode],
    queryFn: async (): Promise<Task[]> => {
      if (!parentId) return [];

      if (isGuestMode) {
        return mockStore
          .getTasks()
          .filter((t) => t.parent_id === parentId)
          .sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          });
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Task[];
    },
    enabled: !!parentId,
  });
}
