import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import type { Project } from "@/lib/types/task";

export interface CreateProjectInput {
  name: string;
  color: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  color?: string;
  is_archived?: boolean;
}

export const projectMutations = {
  create: async (input: CreateProjectInput): Promise<Project> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      return mockStore.addProject({
        ...input,
        view_style: "list",
        is_inbox: false,
        is_archived: false,
      });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: input.name,
        color: input.color,
        is_inbox: false,
        is_archived: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Project;
  },

  update: async (input: UpdateProjectInput): Promise<Project> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { id, ...updates } = input;

    if (isGuest) {
      const updatedProject = mockStore.updateProject(id, updates);
      if (!updatedProject) throw new Error("Project not found");
      return updatedProject;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Project;
  },

  archive: async (id: string): Promise<Project> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const project = mockStore.updateProject(id, { is_archived: true });
      if (!project) throw new Error("Project not found");
      return project;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .update({ is_archived: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Project;
  },

  moveTasksToInbox: async (projectId: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      // fallback in case mockStore doesn't implement it yet
      mockStore.moveTasksToInbox?.(projectId);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ project_id: null })
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);
  },

  deleteProjectTasks: async (projectId: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      mockStore.deleteTasksByProject?.(projectId);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);
  },

  unarchive: async (id: string): Promise<Project> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const project = mockStore.updateProject(id, { is_archived: false });
      if (!project) throw new Error("Project not found");
      return project;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .update({ is_archived: false })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Project;
  },

  delete: async (id: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      mockStore.deleteProject(id);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) throw new Error(error.message);
  },
};
