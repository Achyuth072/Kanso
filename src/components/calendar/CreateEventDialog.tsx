"use client";

"use no memo";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import { useForm, useWatch, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isValid } from "date-fns";
import {
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Check,
  Send,
  Save,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateTimeWizard } from "@/components/ui/date-time-wizard";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "@/lib/hooks/useCalendarEventMutations";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { parseEventInput } from "@/lib/utils/nlp-event";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useCalendarStore } from "@/lib/calendar/store";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  all_day: z.boolean().default(false),
});

type CreateEventFormData = z.infer<typeof CreateEventSchema>;

const PREDEFINED_LOCATIONS = [
  "Coffee Shop",
  "Office",
  "Zoom Meeting",
  "Google Meet",
  "Home",
  "Library",
  "Gym",
];

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  event?: CalendarEventUI;
}

function coerceValidDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return isValid(value) ? value : undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return isValid(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getDefaultEndDate(start: Date) {
  return new Date(start.getTime() + 3600000);
}

export function CreateEventDialog({
  open,
  onOpenChange,
  defaultDate,
  event,
}: CreateEventDialogProps) {
  const { trigger } = useHaptic();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const isFinePointer = useMediaQuery("(pointer: fine)");
  const normalizedDefaultDate = coerceValidDate(defaultDate);
  const normalizedEventStart = coerceValidDate(event?.start);
  const normalizedEventEnd = coerceValidDate(event?.end);
  const initialStartDate = useMemo(
    () => normalizedEventStart ?? normalizedDefaultDate ?? new Date(),
    [normalizedDefaultDate, normalizedEventStart],
  );
  const initialEndDate = useMemo(
    () => normalizedEventEnd ?? getDefaultEndDate(initialStartDate),
    [initialStartDate, normalizedEventEnd],
  );

  const [startDate, setStartDate] = useState<Date | undefined>(
    initialStartDate,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const events = useCalendarStore((state) => state.events);
  const safeStartDate = coerceValidDate(startDate);
  const safeEndDate = coerceValidDate(endDate);

  const uniqueLocations = useMemo(() => {
    const history = events
      .map((e) => e.location)
      .filter((loc): loc is string => Boolean(loc && loc.trim() !== ""));
    return Array.from(new Set([...PREDEFINED_LOCATIONS, ...history]));
  }, [events]);

  const { register, handleSubmit, control, setValue, reset } =
    useForm<CreateEventFormData>({
      resolver: zodResolver(CreateEventSchema) as any,
      mode: "onChange",
      defaultValues: {
        title: "",
        description: "",
        location: "",
        all_day: false,
      },
    });

  const allDay = useWatch({ control, name: "all_day" });
  const title = useWatch({ control, name: "title" });
  const locationValue = useWatch({ control, name: "location" });
  const { errors } = useFormState({ control });

  // Derive form validity from useWatch values instead of formState.isValid
  // or useFormState().isValid. Both formState and useFormState use RHF's Proxy
  // for property-access subscriptions, which React Compiler memoizes away —
  // isValid never triggers a re-render. useWatch is an explicit hook subscription
  // that React Compiler tracks correctly (proven by allDay toggle, title, location
  // all updating). Same pattern as watch() → useWatch() fix in FocusSettingsDialog.
  const isFormValid =
    !!title && title.trim().length >= 1 && title.length <= 200;

  // NLP parsing on title change (only when creating)
  useEffect(() => {
    if (event || !title || title.length < 3) return;

    // Use title as NLP input
    const parsed = parseEventInput(title);
    const start = parsed.start;
    const end = parsed.end;
    const isAllDay = parsed.allDay;

    if (start) {
      const timer = setTimeout(() => {
        setStartDate(start);
        // Update end date to 1 hour after or use parsed end
        setEndDate(coerceValidDate(end) ?? getDefaultEndDate(start));
        if (isAllDay) {
          setValue("all_day", true);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [title, setValue, event]);

  // Reset/Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        if (event) {
          setStartDate(normalizedEventStart ?? initialStartDate);
          setEndDate(
            normalizedEventEnd ??
              getDefaultEndDate(normalizedEventStart ?? initialStartDate),
          );
          reset({
            title: event.title,
            description: event.description || "",
            location: event.location || "",
            all_day: event.allDay || false,
          });
        } else {
          const now = normalizedDefaultDate ?? new Date();
          setStartDate(now);
          setEndDate(getDefaultEndDate(now));
          reset({
            title: "",
            description: "",
            location: "",
            all_day: false,
          });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [
    event,
    initialStartDate,
    normalizedDefaultDate,
    normalizedEventEnd,
    normalizedEventStart,
    open,
    reset,
  ]);

  const onFormSubmit = (data: CreateEventFormData) => {
    if (!safeStartDate || !safeEndDate) return;

    trigger("thud"); // THUD haptic for save commitment

    if (event) {
      updateEvent.mutate({
        id: event.id,
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        start_time: safeStartDate.toISOString(),
        end_time: safeEndDate.toISOString(),
        all_day: data.all_day,
      });
    } else {
      createEvent.mutate({
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        start_time: safeStartDate.toISOString(),
        end_time: safeEndDate.toISOString(),
        all_day: data.all_day,
      });
    }

    trigger("success");
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!event) return;
    trigger("thud");
    deleteEvent.mutate(event.id);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
        <form
          onSubmit={handleSubmit(onFormSubmit) as any}
          className="flex flex-col h-auto max-h-[90dvh]"
        >
          <ResponsiveDialogHeader className="px-4 pt-6 shrink-0">
            <ResponsiveDialogTitle className="type-h2">
              {event ? "Edit Event" : "Create Event"}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="sr-only">
              Add a new event to your calendar
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
            {/* Title with NLP */}
            <div className="grid gap-2">
              <Label htmlFor="event-title" className="sr-only">
                Event Title
              </Label>
              <Input
                {...register("title")}
                id="event-title"
                placeholder="Lunch at 1pm tomorrow..."
                autoFocus={isFinePointer}
                className={cn(
                  "text-lg font-medium",
                  errors.title && "border-destructive",
                )}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="all-day" className="text-sm font-medium">
                All day
              </Label>
              <Switch
                id="all-day"
                checked={allDay}
                onCheckedChange={(checked) => {
                  trigger("toggle"); // TOGGLE haptic
                  setValue("all_day", checked);
                }}
              />
            </div>

            {/* Start Date/Time */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Start</Label>
              <Popover open={showStartPicker} onOpenChange={setShowStartPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal shadow-none border-border/80"
                    onClick={() => trigger("tick")}
                    type="button"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {safeStartDate
                      ? allDay
                        ? format(safeStartDate, "PPP")
                        : format(safeStartDate, "PPP p")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DateTimeWizard
                    date={safeStartDate}
                    setDate={setStartDate}
                    onClose={() => setShowStartPicker(false)}
                    showTime={!allDay}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date/Time */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium">End</Label>
              <Popover open={showEndPicker} onOpenChange={setShowEndPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal shadow-none border-border/80"
                    onClick={() => trigger("tick")}
                    type="button"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {safeEndDate
                      ? allDay
                        ? format(safeEndDate, "PPP")
                        : format(safeEndDate, "PPP p")
                      : "Pick an end time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DateTimeWizard
                    date={safeEndDate}
                    setDate={setEndDate}
                    onClose={() => setShowEndPicker(false)}
                    showTime={!allDay}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location */}
            <div className="grid gap-2">
              <Label htmlFor="event-location" className="text-sm font-medium">
                Location
              </Label>
              <Popover
                open={locationOpen}
                onOpenChange={setLocationOpen}
                modal={false}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={locationOpen}
                    className="w-full justify-start text-left font-normal shadow-none border-border/80"
                  >
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    {locationValue || (
                      <span className="text-muted-foreground">
                        Search location...
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[var(--radix-popover-trigger-width)] z-[60] data-[state=closed]:animate-none data-[state=closed]:duration-0 data-[state=closed]:fade-out-0"
                  align="start"
                  onMouseDown={(e) => e.preventDefault()}
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  <Command shouldFilter={true}>
                    <CommandInput
                      placeholder="Search or enter location..."
                      value={locationValue || ""}
                      onValueChange={(val) => {
                        setValue("location", val, { shouldValidate: true });
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>
                        Press enter or click outside to use custom location
                      </CommandEmpty>
                      <CommandGroup heading="Suggestions">
                        {uniqueLocations.map((loc) => (
                          <CommandItem
                            key={loc}
                            value={loc}
                            className="text-foreground data-[selected=true]:bg-brand data-[selected=true]:text-brand-foreground"
                            onSelect={() => {
                              setValue("location", loc, {
                                shouldValidate: true,
                              });
                              setLocationOpen(false);
                            }}
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            {loc}
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                locationValue === loc
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label
                htmlFor="event-description"
                className="text-sm font-medium"
              >
                Notes
              </Label>
              <Textarea
                {...register("description")}
                id="event-description"
                placeholder="Add notes..."
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-end items-center gap-3 p-4 border-t pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background">
            {event && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-10 w-10 p-0 [&_svg]:!size-5 rounded-lg transition-seijaku-fast"
                onClick={handleDelete}
                disabled={deleteEvent.isPending}
                title="Delete event"
              >
                <Trash2 strokeWidth={2.25} />
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={
                !isFormValid ||
                !safeStartDate ||
                !safeEndDate ||
                createEvent.isPending ||
                updateEvent.isPending
              }
              className="h-10 w-10 p-0 rounded-lg bg-brand hover:bg-brand/90 text-brand-foreground shadow-sm shadow-brand/10 transition-seijaku flex items-center justify-center"
              title={event ? "Save changes" : "Create event"}
              aria-label={event ? "Save changes" : "Create event"}
            >
              {event ? (
                <Save className="h-5 w-5 stroke-[2.25px]" />
              ) : (
                <Send className="h-5 w-5 stroke-[2.25px]" />
              )}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
