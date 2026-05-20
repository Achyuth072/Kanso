"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { Project } from "@/lib/types/task";

export function useProjects() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["projects", isGuestMode],
    queryFn: async (): Promise<Project[]> => {
      // Guest Mode: Use mock store
      if (isGuestMode) {
        return mockStore
          .getProjects()
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // Normal Supabase flow
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", false)
        .order("is_inbox", { ascending: false }) // Inbox first
        .order("name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Project[];
    },
  });
}

export function useProject(projectId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["project", projectId, isGuestMode],
    queryFn: async (): Promise<Project | null> => {
      if (!projectId) return null;

      // Guest Mode: Use mock store
      if (isGuestMode) {
        return mockStore.getProject(projectId);
      }

      // Normal Supabase flow
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Project;
    },
    enabled: !!projectId,
  });
}

export function useArchivedProjects() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["projects", "archived", isGuestMode],
    queryFn: async (): Promise<Project[]> => {
      // Guest Mode: Use mock store
      if (isGuestMode) {
        return mockStore
          .getProjects()
          .filter((p) => p.is_archived)
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // Normal Supabase flow
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", true)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return data as Project[];
    },
  });
}
