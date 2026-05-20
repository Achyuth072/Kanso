"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUpdateProject } from "@/lib/hooks/useProjectMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";

import { ColorPicker } from "@/components/shared/ColorPicker";
import { cn } from "@/lib/utils";
import { PROJECT_COLORS } from "@/lib/constants/colors";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Project } from "@/lib/types/task";

const EditProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  color: z.string(),
});

type EditProjectInput = z.infer<typeof EditProjectSchema>;

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: EditProjectDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<EditProjectInput>({
    resolver: zodResolver(EditProjectSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      color: PROJECT_COLORS[0].hex,
    },
  });

  const color = useWatch({
    control,
    name: "color",
    defaultValue: PROJECT_COLORS[0].hex,
  });

  const updateProject = useUpdateProject();
  const { trigger } = useHaptic();
  // const scrollRef = useHorizontalScroll();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  // Sync form with project when opened
  useEffect(() => {
    if (project && open) {
      reset({
        name: project.name,
        color: project.color,
      });
    }
  }, [project, open, reset]);

  const onFormSubmit = (data: EditProjectInput) => {
    if (!project) return;
    trigger("success");
    updateProject.mutate({
      id: project.id,
      name: data.name,
      color: data.color,
    });
    onOpenChange(false);
  };

  if (!project) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[400px] p-0 overflow-hidden">
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="flex flex-col h-auto max-h-[90dvh]"
        >
          <ResponsiveDialogHeader className="px-4 pt-6 shrink-0">
            <ResponsiveDialogTitle className="type-h2">
              Edit Project
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              Update project name and color.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-name" className="sr-only">
                Project Name
              </Label>
              <Textarea
                {...register("name")}
                id="edit-project-name"
                placeholder="Project name..."
                autoFocus={isFinePointer}
                className={cn(
                  "text-xl sm:text-2xl font-semibold px-3 py-2 h-10 min-h-[40px] bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-sm resize-none placeholder:text-muted-foreground/30 tracking-tight leading-tight rounded-md transition-all",
                  errors.name &&
                    "text-destructive placeholder:text-destructive/50 border-destructive/20 focus-visible:ring-destructive",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (isValid && isDirty) {
                      handleSubmit(onFormSubmit)();
                    }
                  }
                }}
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? "edit-project-name-error" : undefined
                }
              />
              {errors.name && (
                <p
                  id="edit-project-name-error"
                  className="text-xs font-medium text-destructive mt-1"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <ColorPicker
              value={color}
              onChange={(newColor) =>
                setValue("color", newColor, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              label="Color"
              ariaLabel="Project color"
            />
          </div>

          <div className="shrink-0 flex justify-end gap-3 p-4 border-t pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                trigger("tick");
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || !isDirty || updateProject.isPending}
              className="bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku h-10 px-6"
            >
              {updateProject.isPending ? "Saving..." : "Save Project"}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
