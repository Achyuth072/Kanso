"use client";

import { FieldErrors } from "react-hook-form";
import { CreateHabitInput } from "@/lib/schemas/habit";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Save, Trash2, CalendarIcon, Hash } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { HabitIconPicker } from "./shared/HabitIconPicker";
import { ColorPicker } from "@/components/shared/ColorPicker";
import { TaskDatePicker } from "../tasks/shared/TaskDatePicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

import type { Habit } from "@/lib/types/habit";

interface HabitEditViewProps {
  _initialHabit: Habit;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  icon: string;
  setIcon: (value: string) => void;
  startDate: Date | undefined;
  setStartDate: (value: Date | undefined) => void;
  datePickerOpen: boolean;
  setDatePickerOpen: (value: boolean) => void;
  isMobile: boolean;
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateHabitInput>;
}

export function HabitEditView({
  _initialHabit,
  name,
  setName,
  description,
  setDescription,
  color,
  setColor,
  icon,
  setIcon,
  startDate,
  setStartDate,
  datePickerOpen,
  setDatePickerOpen,
  isMobile,
  hasContent,
  isPending,
  onSubmit,
  onDelete,
  onKeyDown,
  errors,
}: HabitEditViewProps) {
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  return (
    <div className="flex flex-col flex-1 overflow-hidden w-full max-w-full">
      {/* Header handled by parent HabitSheet */}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 w-full scrollbar-none">
        {/* Hero Icon Selection */}
        <HabitIconPicker value={icon} onChange={setIcon} color={color} />

        {/* Name & Description Inputs */}
        <div className="space-y-4">
          <div className="space-y-1">
            <Label
              htmlFor="habit-name-edit"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5 px-1"
            >
              <Hash className="h-3 w-3" />
              Habit Name
            </Label>
            <Textarea
              id="habit-name-edit"
              placeholder="Habit name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus={isFinePointer}
              className={cn(
                "text-xl sm:text-2xl font-semibold px-3 py-2 h-10 min-h-[40px] bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-none resize-none placeholder:text-muted-foreground/30 tracking-tight leading-tight rounded-md transition-all",
                errors?.name &&
                  "text-destructive placeholder:text-destructive/50 border-destructive/20",
              )}
              aria-invalid={!!errors?.name}
              aria-describedby={
                errors?.name ? "habit-name-edit-error" : undefined
              }
            />
            {errors?.name && (
              <p
                id="habit-name-edit-error"
                className="text-xs font-medium text-destructive mt-1 px-1"
              >
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="habit-description-edit"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 px-1"
            >
              Description
            </Label>
            <Textarea
              id="habit-description-edit"
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-[15px] px-3 py-2 h-10 min-h-[40px] bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-none resize-none placeholder:text-muted-foreground/40 leading-relaxed rounded-md transition-all"
            />
          </div>

          <div className="pt-2">
            <ColorPicker
              value={color}
              onChange={setColor}
              label="Appearance"
              ariaLabel="Habit color"
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 flex items-center justify-between p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-nowrap min-w-0 pr-8 py-1">
          <TaskDatePicker
            date={startDate}
            setDate={setStartDate}
            isMobile={isMobile}
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            variant="icon"
            icon={CalendarIcon}
            title="Start date"
            showTime={true}
            allowPastDates={true}
            side="top"
            align="start"
            sideOffset={15}
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="destructive"
            size="sm"
            className="h-10 w-10 p-0 [&_svg]:!size-5 rounded-lg transition-seijaku-fast"
            onClick={() => {
              trigger("thud");
              onDelete();
            }}
            title="Delete habit"
            disabled={isPending}
          >
            <Trash2 strokeWidth={2.25} />
          </Button>

          <Button
            size="sm"
            className="h-10 w-10 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
            onClick={() => {
              trigger("success");
              onSubmit();
            }}
            disabled={!hasContent || isPending}
            title={isPending ? "Saving..." : "Save Changes"}
            aria-label={isPending ? "Saving" : "Save changes"}
          >
            <Save className="h-5 w-5 stroke-[2.25px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
