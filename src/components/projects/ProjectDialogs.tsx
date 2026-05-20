"use client";

import { useProjectActions } from "@/components/ProjectActionsProvider";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";

/**
 * Renders project-related dialogs at app level based on ProjectActionsProvider state.
 * Must be rendered inside ProjectActionsProvider.
 */
export function ProjectDialogs() {
  const { activeProject, actionType, closeProjectAction } = useProjectActions();

  // Ensure we have a project to edit/delete before rendering
  if (!activeProject && actionType !== null) {
    return null;
  }

  return (
    <>
      <EditProjectDialog
        project={actionType === "edit" ? activeProject : null}
        open={actionType === "edit" && activeProject !== null}
        onOpenChange={(open) => {
          if (!open) closeProjectAction();
        }}
      />
      <DeleteProjectDialog
        project={actionType === "delete" ? activeProject : null}
        open={actionType === "delete" && activeProject !== null}
        onOpenChange={(open) => {
          if (!open) closeProjectAction();
        }}
      />
    </>
  );
}
