"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Project } from "@/lib/types/task";

interface ProjectActionsContextValue {
  isCreateProjectOpen: boolean;
  openCreateProject: () => void;
  closeCreateProject: () => void;
  // New edit/delete actions
  activeProject: Project | null;
  actionType: "edit" | "delete" | null;
  openEditProject: (project: Project) => void;
  openDeleteProject: (project: Project) => void;
  closeProjectAction: () => void;
}

const ProjectActionsContext = createContext<ProjectActionsContextValue | null>(
  null,
);

export function ProjectActionsProvider({ children }: { children: ReactNode }) {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [actionType, setActionType] = useState<"edit" | "delete" | null>(null);

  const openCreateProject = React.useCallback(
    () => setIsCreateProjectOpen(true),
    [],
  );
  const closeCreateProject = React.useCallback(
    () => setIsCreateProjectOpen(false),
    [],
  );

  const openEditProject = React.useCallback((project: Project) => {
    setActiveProject(project);
    setActionType("edit");
  }, []);

  const openDeleteProject = React.useCallback((project: Project) => {
    setActiveProject(project);
    setActionType("delete");
  }, []);

  const closeProjectAction = React.useCallback(() => {
    setActiveProject(null);
    setActionType(null);
  }, []);

  const value = React.useMemo(
    () => ({
      isCreateProjectOpen,
      openCreateProject,
      closeCreateProject,
      activeProject,
      actionType,
      openEditProject,
      openDeleteProject,
      closeProjectAction,
    }),
    [
      isCreateProjectOpen,
      openCreateProject,
      closeCreateProject,
      activeProject,
      actionType,
      openEditProject,
      openDeleteProject,
      closeProjectAction,
    ],
  );

  return (
    <ProjectActionsContext.Provider value={value}>
      {children}
    </ProjectActionsContext.Provider>
  );
}

export function useProjectActions() {
  const context = useContext(ProjectActionsContext);
  if (!context) {
    throw new Error(
      "useProjectActions must be used within a ProjectActionsProvider",
    );
  }
  return context;
}
