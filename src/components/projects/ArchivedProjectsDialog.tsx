"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { useArchivedProjects } from "@/lib/hooks/useProjects";
import { useUnarchiveProject } from "@/lib/hooks/useProjectMutations";
import { Button } from "@/components/ui/button";
import { ArchiveRestore, Loader2 } from "lucide-react";

interface ArchivedProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchivedProjectsDialog({
  open,
  onOpenChange,
}: ArchivedProjectsDialogProps) {
  const { data: archivedProjects, isLoading } = useArchivedProjects();
  const unarchiveProject = useUnarchiveProject();

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md p-0 overflow-hidden">
        <ResponsiveDialogHeader className="px-4 pt-6 shrink-0">
          <ResponsiveDialogTitle className="type-h2">
            Archived Projects
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            View and restore archived projects
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : archivedProjects && archivedProjects.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
              {archivedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="font-medium">{project.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 hover:bg-secondary"
                    onClick={() => unarchiveProject.mutate(project.id)}
                    disabled={unarchiveProject.isPending}
                  >
                    <ArchiveRestore className="h-4 w-4" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No archived projects found.</p>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
