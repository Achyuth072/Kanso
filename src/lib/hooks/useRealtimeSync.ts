"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { isGuestMode } = useAuth();

  useEffect(() => {
    if (isGuestMode) return;

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          // Invalidate tasks query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase, isGuestMode]);
}
