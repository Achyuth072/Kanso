"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/schemas/task";
import type { Task } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import { useUpdateTask, useDeleteTask } from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import dynamic from "next/dynamic";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";

const TaskEditView = dynamic(
  () => import("./TaskEditView").then((mod) => mod.TaskEditView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  },
);

interface TaskDetailPanelProps {
  task: Task | null;
  onClose?: () => void;
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { trigger } = useHaptic();

  // React Hook Form
  type TaskFormValues = CreateTaskInput & {
    recurrence?: RecurrenceRule | null;
  };

  const {
    handleSubmit,
    setValue,
    control,
    reset,
    trigger: triggerValidation,
    formState: { errors, isValid },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(CreateTaskSchema),
    mode: "onChange",
    defaultValues: {
      content: "",
      description: "",
      priority: 4,
      is_evening: false,
    },
  });

  // Individual UI-only states
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [doDatePickerOpen, setDoDatePickerOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [showSubtasks, setShowSubtasks] = useState(false);

  // Form values via useWatch
  const content = useWatch({ control, name: "content" });
  const watchedDueDate = useWatch({ control, name: "due_date" });
  const dueDate = watchedDueDate
    ? new Date(watchedDueDate as string)
    : undefined;
  const watchedDoDate = useWatch({ control, name: "do_date" });
  const doDate = watchedDoDate ? new Date(watchedDoDate as string) : undefined;
  const isEvening = useWatch({ control, name: "is_evening" }) ?? false;
  const priority = (useWatch({ control, name: "priority" }) ?? 4) as
    | 1
    | 2
    | 3
    | 4;
  const recurrence = useWatch({
    control,
    name: "recurrence",
  }) as RecurrenceRule | null;
  const selectedProjectId = useWatch({ control, name: "project_id" }) ?? null;
  const description = useWatch({ control, name: "description" }) || "";

  // Hooks
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: inboxProject } = useInboxProject();
  const { data: projects } = useProjects();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Reset UI-only states during render when task changes
  const [prevTask, setPrevTask] = useState(task);
  if (task !== prevTask) {
    setPrevTask(task);
    if (task) {
      setDraftSubtasks([]);
      setIsPreviewMode(!!task.description);
    }
  }

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      reset({
        content: task.content,
        description: task.description || "",
        due_date: task.due_date ?? undefined,
        do_date: task.do_date ?? undefined,
        is_evening: task.is_evening || false,
        priority: task.priority,
        project_id: task.project_id ?? undefined,
      });
      void triggerValidation();
    }
  }, [task, reset, triggerValidation]);

  // Handlers
  const onFormSubmit = useCallback(
    (data: CreateTaskInput) => {
      if (!task) return;

      trigger("success"); // Success signature haptic

      updateMutation.mutate({
        ...data,
        id: task.id,
        due_date:
          data.due_date instanceof Date
            ? data.due_date.toISOString()
            : data.due_date || null,
        do_date:
          data.do_date instanceof Date
            ? data.do_date.toISOString()
            : data.do_date || null,
      });

      onClose?.();
    },
    [task, updateMutation, onClose, trigger],
  );

  const handleDelete = useCallback(() => {
    if (!task) return;
    setShowDeleteDialog(true);
  }, [task]);

  const handleConfirmDelete = useCallback(() => {
    if (!task) return;
    trigger("thud"); // Thud haptic for delete
    setShowDeleteDialog(false);
    onClose?.();
    deleteMutation.mutate(task.id);
  }, [task, deleteMutation, onClose, trigger]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit(onFormSubmit)();
      }
      if (e.key === "Escape") onClose?.();
    },
    [handleSubmit, onFormSubmit, onClose],
  );

  // Derived State
  const isPending = updateMutation.isPending;

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center p-16 animate-in fade-in duration-500">
        <p className="type-body text-muted-foreground/50 font-medium">
          Select a task to view details
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full relative overflow-hidden">
        {onClose && (
          <button
            onClick={() => {
              trigger("tick");
              onClose();
            }}
            className="absolute top-3 right-3 z-50 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 border border-border transition-all duration-200"
            aria-label="Close task details"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        <TaskEditView
          initialTask={task}
          content={content}
          setContent={(v) => setValue("content", v, { shouldValidate: true })}
          description={description}
          setDescription={(v) =>
            setValue("description", v, { shouldValidate: true })
          }
          isPreviewMode={isPreviewMode}
          setIsPreviewMode={setIsPreviewMode}
          dueDate={dueDate}
          setDueDate={(v) => setValue("due_date", v, { shouldValidate: true })}
          doDate={doDate}
          setDoDate={(v) => setValue("do_date", v, { shouldValidate: true })}
          isEvening={isEvening}
          setIsEvening={(v) =>
            setValue("is_evening", v, { shouldValidate: true })
          }
          priority={priority}
          setPriority={(v) => setValue("priority", v, { shouldValidate: true })}
          recurrence={recurrence}
          setRecurrence={(v) =>
            setValue("recurrence", v, { shouldValidate: true })
          }
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={(v) =>
            setValue("project_id", v, { shouldValidate: true })
          }
          datePickerOpen={datePickerOpen}
          setDatePickerOpen={setDatePickerOpen}
          doDatePickerOpen={doDatePickerOpen}
          setDoDatePickerOpen={setDoDatePickerOpen}
          showSubtasks={showSubtasks}
          setShowSubtasks={setShowSubtasks}
          draftSubtasks={draftSubtasks}
          setDraftSubtasks={setDraftSubtasks}
          inboxProjectId={inboxProject?.id || null}
          projects={projects}
          isMobile={isMobile}
          hasContent={isValid}
          isPending={isPending}
          onSubmit={handleSubmit(onFormSubmit)}
          onDelete={handleDelete}
          onKeyDown={handleKeyDown}
          errors={errors}
          mode="panel"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.content}"? This action cannot be undone.`}
      />
    </>
  );
}
