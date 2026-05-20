"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { useHaptic } from "@/lib/hooks/useHaptic";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ListChecks, Send, Inbox, Moon, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { TaskPrioritySelect } from "./shared/TaskPrioritySelect";
import RecurrencePicker from "./TaskSheet/RecurrencePicker";
import type { Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

import { FieldErrors } from "react-hook-form";
import type { CreateTaskInput } from "@/lib/schemas/task";

interface TaskCreateViewProps {
  content: string;
  setContent: (value: string) => void;
  dueDate: Date | undefined;
  setDueDate: (value: Date | undefined) => void;
  doDate: Date | undefined;
  setDoDate: (value: Date | undefined) => void;
  isEvening: boolean;
  setIsEvening: (value: boolean) => void;
  priority: 1 | 2 | 3 | 4;
  setPriority: (value: 1 | 2 | 3 | 4) => void;
  recurrence: RecurrenceRule | null;
  setRecurrence: (value: RecurrenceRule | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (value: string | null) => void;
  datePickerOpen: boolean;
  setDatePickerOpen: (value: boolean) => void;
  doDatePickerOpen: boolean;
  setDoDatePickerOpen: (value: boolean) => void;
  showSubtasks: boolean;
  setShowSubtasks: (value: boolean) => void;
  draftSubtasks: string[];
  setDraftSubtasks: (value: string[]) => void;
  inboxProjectId: string | null;
  projects: Project[] | undefined;
  isMobile: boolean;
  hasContent: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateTaskInput>;
}

export function TaskCreateView({
  content,
  setContent,
  dueDate,
  setDueDate,
  doDate,
  setDoDate,
  isEvening,
  setIsEvening,
  priority,
  setPriority,
  recurrence,
  setRecurrence,
  selectedProjectId,
  setSelectedProjectId,
  datePickerOpen,
  setDatePickerOpen,
  doDatePickerOpen,
  setDoDatePickerOpen,
  showSubtasks,
  setShowSubtasks,
  draftSubtasks,
  setDraftSubtasks,
  inboxProjectId,
  projects,
  isMobile,
  hasContent,
  isPending,
  onSubmit,
  onKeyDown,
  errors,
}: TaskCreateViewProps) {
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  return (
    <div className="flex flex-col h-auto w-full max-w-full overflow-hidden">
      <div className="flex-1 min-h-0 px-4 py-4 space-y-4 w-full">
        {/* Task Name Input */}
        <div>
          <Label htmlFor="task-content" className="sr-only">
            Task Content
          </Label>
          <Textarea
            id="task-content"
            placeholder="What needs to be done?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus={isFinePointer}
            className={cn(
              "text-xl sm:text-2xl font-semibold px-3 py-2 h-10 min-h-[40px] bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-sm resize-none placeholder:text-muted-foreground/30 tracking-tight leading-tight rounded-md transition-all",
              errors?.content &&
                "text-destructive placeholder:text-destructive/50 border-destructive/20",
            )}
            aria-invalid={!!errors?.content}
            aria-describedby={
              errors?.content ? "task-content-error" : undefined
            }
          />
          {errors?.content && (
            <p
              id="task-content-error"
              className="text-xs font-medium text-destructive mt-1"
            >
              {errors.content.message}
            </p>
          )}
        </div>

        {/* Icon Row - Metadata Controls */}
        <div className="flex items-center gap-3 pt-2 pb-4 overflow-x-auto scrollbar-hide flex-wrap">
          <TaskDatePicker
            date={dueDate}
            setDate={setDueDate}
            isMobile={isMobile}
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            variant="icon"
            side="right"
            align="center"
            sideOffset={15}
            error={!!errors?.due_date}
          />

          <TaskDatePicker
            date={doDate}
            setDate={setDoDate}
            isMobile={isMobile}
            open={doDatePickerOpen}
            onOpenChange={setDoDatePickerOpen}
            variant="icon"
            title={!isMobile ? "Start Date" : undefined}
            icon={CalendarClock}
            side="right"
            align="center"
            sideOffset={15}
            error={!!errors?.do_date}
          />

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 px-3 transition-all text-muted-foreground hover:text-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none gap-1.5 shrink-0 rounded-lg",
              isEvening &&
                "text-brand bg-brand/10 border-transparent hover:bg-brand/20 hover:text-brand",
            )}
            onClick={() => {
              const nextValue = !isEvening;
              trigger("toggle");
              setIsEvening(nextValue);
              if (nextValue && !doDate) {
                setDoDate(new Date());
              }
            }}
            title={!isMobile ? "This Evening" : undefined}
            aria-label="This Evening"
          >
            <Moon strokeWidth={2.25} className="h-4 w-4" />
            {!isMobile && <span className="type-ui">Evening</span>}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              trigger("toggle");
              setShowSubtasks(!showSubtasks);
            }}
            className={cn(
              "h-9 w-9 p-0 transition-all text-muted-foreground hover:text-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none group [&_svg]:!size-4 shrink-0 rounded-lg",
              showSubtasks &&
                "text-brand bg-brand/10 border-transparent hover:bg-brand/20 hover:text-brand",
            )}
            title={!isMobile ? "Toggle subtasks" : undefined}
            aria-label="Toggle subtasks"
          >
            <ListChecks strokeWidth={2.25} className="transition-all" />
          </Button>

          <div className="shrink-0">
            <TaskPrioritySelect
              priority={priority}
              setPriority={setPriority}
              variant="icon"
              isMobile={isMobile}
            />
          </div>

          <div className="shrink-0">
            <RecurrencePicker
              value={recurrence}
              onChange={setRecurrence}
              variant="icon"
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Subtasks Section - Collapsible */}
        {showSubtasks && (
          <div className="grid gap-2">
            <div>
              <Label>Subtasks</Label>
            </div>
            <div className="pl-1">
              <SubtaskList
                taskId={undefined}
                projectId={inboxProjectId}
                draftSubtasks={draftSubtasks}
                onDraftSubtasksChange={setDraftSubtasks}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Row - Project & Send */}
      <div className="shrink-0 flex items-center justify-between p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background">
        <Select
          value={selectedProjectId || "inbox"}
          onValueChange={(v) => {
            trigger("toggle");
            setSelectedProjectId(v === "inbox" ? null : v);
          }}
        >
          <SelectTrigger
            onPointerDown={() => trigger("toggle")}
            className="h-9 w-auto min-w-[130px] max-w-[200px] type-ui border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none focus:ring-0 transition-all rounded-lg text-foreground [&_svg]:opacity-100 [&_svg]:text-foreground px-3"
          >
            <SelectValue placeholder="Inbox" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border/80 shadow-2xl">
            <SelectItem value="inbox">
              <div className="flex items-center gap-2">
                <Inbox strokeWidth={2.25} className="h-4 w-4" />
                <span className="font-medium">Inbox</span>
              </div>
            </SelectItem>
            {projects
              ?.filter((p) => !p.is_inbox)
              .map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate font-medium">{project.name}</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {(errors?.due_date || errors?.do_date) && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-destructive/10 text-destructive text-[10px] font-bold px-3 py-1 rounded-md animate-in slide-in-from-top-1 fade-in duration-200 pointer-events-none text-center">
            {errors?.due_date?.message || errors?.do_date?.message}
          </div>
        )}

        <Button
          size="sm"
          className="h-9 w-9 p-0 rounded-lg [&_svg]:size-4 bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku"
          onClick={() => {
            trigger("success");
            onSubmit();
          }}
          disabled={!hasContent || isPending}
          title={!isMobile ? "Create task" : undefined}
          aria-label="Create task"
        >
          <Send className="stroke-[2.25px]" />
        </Button>
      </div>
    </div>
  );
}
