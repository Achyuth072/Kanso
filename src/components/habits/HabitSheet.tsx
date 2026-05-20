"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
} from "@/lib/hooks/useHabitMutations";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateHabitSchema, type CreateHabitInput } from "@/lib/schemas/habit";
import type { Habit } from "@/lib/types/habit";
import { HabitCreateView } from "./HabitCreateView";
import { HabitEditView } from "./HabitEditView";

interface HabitSheetProps {
  open: boolean;
  onClose: () => void;
  initialHabit?: Habit | null;
}

export function HabitSheet({ open, onClose, initialHabit }: HabitSheetProps) {
  // Logic to prevent flickering between Create/Edit modes during close animation
  const [preservedHabit, setPreservedHabit] = useState<
    Habit | null | undefined
  >(initialHabit);

  if (open && initialHabit !== preservedHabit) {
    setPreservedHabit(initialHabit);
  }

  const effectiveHabit = open ? initialHabit : preservedHabit;

  const {
    handleSubmit,
    setValue,
    control,
    reset,
    trigger: triggerValidation,
    formState: { errors, isValid },
  } = useForm<CreateHabitInput>({
    resolver: zodResolver(CreateHabitSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      color: "#4B6CB7",
      icon: "Flame",
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Watch values for child components
  const name = useWatch({ control, name: "name" });
  const description = useWatch({ control, name: "description" }) || "";
  const color = useWatch({ control, name: "color" }) || "#4B6CB7";
  const icon = useWatch({ control, name: "icon" }) || "Flame";
  const startDate = useWatch({ control, name: "start_date" });

  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit();
  const deleteMutation = useDeleteHabit();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { trigger: triggerHaptic } = useHaptic();

  // Sync form with initialHabit on open
  useEffect(() => {
    if (open) {
      if (initialHabit) {
        reset({
          name: initialHabit.name,
          description: initialHabit.description || "",
          color: initialHabit.color,
          icon: initialHabit.icon || "Flame",
          start_date: initialHabit.start_date,
        });
        void triggerValidation();
      } else {
        reset({
          name: "",
          description: "",
          color: "#4B6CB7",
          icon: "Flame",
          start_date: undefined,
        });
      }
    }
  }, [open, initialHabit, reset, triggerValidation]);

  const onFormSubmit = useCallback(
    (data: CreateHabitInput) => {
      triggerHaptic("thud");

      const formattedData = {
        ...data,
        start_date:
          data.start_date instanceof Date
            ? data.start_date.toISOString().split("T")[0]
            : data.start_date,
      };

      if (initialHabit) {
        updateMutation.mutate({
          ...formattedData,
          id: initialHabit.id,
        });
      } else {
        createMutation.mutate(formattedData);
      }

      onClose();
    },
    [initialHabit, updateMutation, createMutation, onClose, triggerHaptic],
  );

  const handleDelete = useCallback(() => {
    if (!initialHabit) return;
    setShowDeleteDialog(true);
  }, [initialHabit]);

  const handleConfirmDelete = useCallback(() => {
    if (!initialHabit) return;
    setShowDeleteDialog(false);
    onClose();
    deleteMutation.mutate(initialHabit.id);
  }, [initialHabit, onClose, deleteMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit(onFormSubmit)();
      }
    },
    [handleSubmit, onFormSubmit],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCreationMode = !effectiveHabit;

  return (
    <ResponsiveDialog open={open} onOpenChange={onClose}>
      <ResponsiveDialogContent className="w-full sm:max-w-lg gap-0 rounded-lg p-0 overflow-hidden outline-none">
        <div className="flex flex-col max-h-[90vh]">
          <div className="px-4 pt-6 pb-4 border-b border-border/10 shrink-0 bg-background">
            <ResponsiveDialogTitle className="type-h2">
              {initialHabit ? "Edit Habit" : "New Habit"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              {initialHabit
                ? "Update your habit details and tracking frequency."
                : "Create a new habit to start tracking your daily progress."}
            </ResponsiveDialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {isCreationMode ? (
              <HabitCreateView
                name={name}
                setName={(v) => setValue("name", v, { shouldValidate: true })}
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                color={color}
                setColor={(v) => setValue("color", v, { shouldValidate: true })}
                icon={icon}
                setIcon={(v) => setValue("icon", v, { shouldValidate: true })}
                startDate={
                  startDate ? new Date(startDate as string) : undefined
                }
                setStartDate={(v) =>
                  setValue("start_date", v?.toISOString().split("T")[0], {
                    shouldValidate: true,
                  })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
                isMobile={isMobile}
                hasContent={isValid}
                isPending={isPending}
                onSubmit={handleSubmit(onFormSubmit)}
                onKeyDown={handleKeyDown}
                errors={errors}
              />
            ) : (
              <HabitEditView
                _initialHabit={effectiveHabit!}
                name={name}
                setName={(v) => setValue("name", v, { shouldValidate: true })}
                description={description}
                setDescription={(v) =>
                  setValue("description", v, { shouldValidate: true })
                }
                color={color}
                setColor={(v) => setValue("color", v, { shouldValidate: true })}
                icon={icon}
                setIcon={(v) => setValue("icon", v, { shouldValidate: true })}
                startDate={
                  startDate ? new Date(startDate as string) : undefined
                }
                setStartDate={(v) =>
                  setValue("start_date", v?.toISOString().split("T")[0], {
                    shouldValidate: true,
                  })
                }
                datePickerOpen={datePickerOpen}
                setDatePickerOpen={setDatePickerOpen}
                isMobile={isMobile}
                hasContent={isValid}
                isPending={isPending}
                onSubmit={handleSubmit(onFormSubmit)}
                onDelete={handleDelete}
                onKeyDown={handleKeyDown}
                errors={errors}
              />
            )}
          </div>
        </div>
      </ResponsiveDialogContent>

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Habit"
        description={`Are you sure you want to delete "${initialHabit?.name}"? This will also delete all completion history.`}
      />
    </ResponsiveDialog>
  );
}
