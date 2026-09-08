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
      if (isGuestMode) {
        return mockStore
          .getProjects()
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      const supabase = createClient();
      // eslint-disable-next-line local/no-unbounded-supabase-select -- project definitions, not tasks
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", false);

      if (error) {
        throw new Error(error.message);
      }

      // Name is encrypted at rest; sorted client-side.
      const projects = data as Project[];
      const inbox = projects.filter((p) => p.is_inbox);
      const rest = projects
        .filter((p) => !p.is_inbox)
        .sort((a, b) => a.name.localeCompare(b.name));
      return [...inbox, ...rest];
    },
  });
}

export function useProject(projectId: string | null) {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["project", projectId, isGuestMode],
    queryFn: async (): Promise<Project | null> => {
      if (!projectId) return null;

      if (isGuestMode) {
        return mockStore.getProject(projectId);
      }

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
      if (isGuestMode) {
        return mockStore
          .getProjects()
          .filter((p) => p.is_archived)
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      const supabase = createClient();
      // eslint-disable-next-line local/no-unbounded-supabase-select -- project definitions, not tasks
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", true);

      if (error) {
        throw new Error(error.message);
      }

      // Name is encrypted at rest; sorted client-side.
      return (data as Project[]).sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
