"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { useHaptic } from "@/lib/hooks/useHaptic";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListChecks,
  Save,
  Trash2,
  Inbox,
  Moon,
  CalendarClock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import SubtaskList from "./SubtaskList";
import { TaskDatePicker } from "./shared/TaskDatePicker";
import { TaskPrioritySelect } from "./shared/TaskPrioritySelect";
import RecurrencePicker from "./TaskSheet/RecurrencePicker";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Task, Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";

import { FieldErrors } from "react-hook-form";
import type { CreateTaskInput } from "@/lib/schemas/task";

interface TaskEditViewProps {
  initialTask: Task;
  content: string;
  setContent: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (value: boolean) => void;
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
  onDelete: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  errors?: FieldErrors<CreateTaskInput>;
  mode?: "sheet" | "panel";
}

export function TaskEditView({
  initialTask,
  content,
  setContent,
  description,
  setDescription,
  isPreviewMode,
  setIsPreviewMode,
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
  onDelete,
  onKeyDown,
  errors,
  mode = "sheet",
}: TaskEditViewProps) {
  const scrollRef = useHorizontalScroll();
  const { trigger } = useHaptic();
  const isFinePointer = useMediaQuery("(pointer: fine)");

  return (
    <div
      className={cn(
        "flex flex-col w-full max-w-full overflow-hidden transition-all",
        mode === "sheet" ? "h-auto" : "h-full",
      )}
    >
      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto px-4 py-4 space-y-4">
        {/* Content Input */}
        <div>
          <Label htmlFor="task-content-edit" className="sr-only">
            Task Content
          </Label>
          <Textarea
            id="task-content-edit"
            placeholder="What needs to be done?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus={isFinePointer}
            className={cn(
              "text-xl sm:text-2xl font-semibold px-3 py-2 h-10 min-h-[40px] bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-none resize-none placeholder:text-muted-foreground/30 tracking-tight leading-tight rounded-md transition-all",
              errors?.content &&
                "text-destructive placeholder:text-destructive/50 border-destructive/20",
            )}
            aria-invalid={!!errors?.content}
            aria-describedby={
              errors?.content ? "task-content-edit-error" : undefined
            }
          />
          {errors?.content && (
            <p
              id="task-content-edit-error"
              className="text-xs font-medium text-destructive mt-1"
            >
              {errors.content.message}
            </p>
          )}
        </div>

        {/* Description Input (Markdown) */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Description</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[10px] uppercase tracking-wider font-bold text-muted-foreground hover:text-foreground bg-background hover:bg-accent hover:text-accent-foreground border border-input shadow-none transition-all rounded-lg"
              onClick={() => {
                trigger("toggle");
                setIsPreviewMode(!isPreviewMode);
              }}
              disabled={!description.trim() && !isPreviewMode}
            >
              {isPreviewMode ? "Edit" : "Preview"}
            </Button>
          </div>

          {isPreviewMode ? (
            <div className="min-h-[160px] p-4 text-[15px] prose prose-sm dark:prose-invert max-w-none bg-secondary/10 rounded-lg overflow-y-auto border border-border/40 scrollbar-hide">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {description || "_No description provided._"}
              </ReactMarkdown>
            </div>
          ) : (
            <Textarea
              placeholder="Add details... (Markdown supported)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={onKeyDown}
              className="min-h-[200px] text-[15px] leading-relaxed px-3 py-2 bg-transparent border-border focus-visible:ring-1 focus-visible:ring-ring shadow-none resize-none placeholder:text-muted-foreground/40 rounded-md transition-all overflow-y-auto scrollbar-hide"
            />
          )}
        </div>

        {/* Subtasks / Checklist */}
        <div className="grid gap-2 pt-2">
          <div className="flex items-center justify-between">
            <Label>Subtasks</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                trigger("toggle");
                setShowSubtasks(!showSubtasks);
              }}
              className={cn(
                "h-9 w-9 p-0 text-muted-foreground hover:text-foreground bg-background hover:bg-accent hover:text-accent-foreground border border-input shadow-none transition-all [&_svg]:!size-4 rounded-lg",
                showSubtasks &&
                  "text-brand bg-brand/10 border-transparent hover:bg-brand/20 hover:text-brand",
              )}
              title="Toggle subtasks"
            >
              <ListChecks strokeWidth={2.25} />
            </Button>
          </div>

          {showSubtasks && (
            <div className="pl-1">
              <SubtaskList
                taskId={initialTask.id}
                projectId={initialTask.project_id || inboxProjectId}
                draftSubtasks={draftSubtasks}
                onDraftSubtasksChange={setDraftSubtasks}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Footer - Actions Row */}
      <div
        className={cn(
          "shrink-0 grid grid-cols-[1fr_auto] gap-4 p-4 border-t border-border/40 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background w-full max-w-full",
        )}
      >
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto scrollbar-hide pr-8 py-1 min-w-0"
        >
          {/* Date & Time Picker (Due Date) */}
          <TaskDatePicker
            date={dueDate}
            setDate={setDueDate}
            isMobile={isMobile}
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            variant="icon"
            error={!!errors?.due_date}
          />

          {/* Start Date (Do Date) */}
          <TaskDatePicker
            date={doDate}
            setDate={setDoDate}
            isMobile={isMobile}
            open={doDatePickerOpen}
            onOpenChange={setDoDatePickerOpen}
            variant="icon"
            title="Start Date"
            icon={CalendarClock}
            error={!!errors?.do_date}
          />

          {/* This Evening Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 px-3 text-[13px] bg-background hover:bg-accent border border-input shadow-none hover:text-foreground shrink-0 gap-1.5 rounded-lg transition-all",
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
            title="This Evening"
          >
            <Moon className="h-4 w-4" strokeWidth={2.25} />
            {!isMobile && <span className="font-medium">Evening</span>}
          </Button>

          {/* Priority Selector */}
          <div className="shrink-0">
            <TaskPrioritySelect
              priority={priority}
              setPriority={setPriority}
              variant="icon"
            />
          </div>

          {/* Recurrence Picker */}
          <div className="shrink-0">
            <RecurrencePicker
              value={recurrence}
              onChange={setRecurrence}
              variant="icon"
            />
          </div>

          {/* Project Selector */}
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
            <SelectContent className="rounded-lg border-border/80 shadow-none">
              <SelectItem value="inbox">
                <div className="flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5" strokeWidth={2.25} />
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
                      <span className="truncate font-medium">
                        {project.name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {(errors?.due_date || errors?.do_date) && (
            <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-destructive/10 text-destructive text-[10px] font-bold px-3 py-1 rounded-md animate-in slide-in-from-top-1 fade-in duration-200">
              {errors?.due_date?.message || errors?.do_date?.message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Delete Button */}
          <Button
            variant="destructive"
            size="sm"
            className="h-9 w-9 p-0 [&_svg]:!size-4 rounded-lg"
            onClick={() => {
              trigger("thud");
              onDelete();
            }}
            title="Delete task"
          >
            <Trash2 strokeWidth={2.25} />
          </Button>

          {/* Submit Button */}
          <Button
            size="sm"
            variant={isPending ? "ghost" : "default"}
            className={cn(
              "h-9 w-9 p-0 rounded-lg [&_svg]:!size-4 transition-seijaku",
              !isPending &&
                "bg-brand hover:bg-brand/90 text-brand-foreground shadow-none",
            )}
            onClick={() => {
              trigger("success");
              onSubmit();
            }}
            disabled={!hasContent || isPending}
            title="Save changes"
          >
            <Save
              strokeWidth={2.25}
              className={cn(isPending && "opacity-50")}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
