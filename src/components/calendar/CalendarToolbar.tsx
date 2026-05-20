"use client";

import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCalendarStore } from "@/lib/calendar/store";
import type { CalendarView } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ImportExportMenu } from "./ImportExportMenu";
import type { CalendarEventUI } from "@/lib/types/calendar-event";

interface CalendarToolbarProps {
  onCreateEvent: () => void;
  className?: string;
  events?: CalendarEventUI[];
}

export function CalendarToolbar({
  onCreateEvent,
  className,
  events = [],
}: CalendarToolbarProps) {
  const { currentDate, view, setView, goToToday, next, prev } =
    useCalendarStore();
  const { trigger } = useHaptic();

  // We render all options and use CSS to hide desktop/mobile specific ones
  const availableViews: {
    value: CalendarView;
    label: string;
    className?: string;
  }[] = [
    { value: "year", label: "Year", className: "hidden md:flex" },
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "4day", label: "4-Day", className: "hidden md:flex" },
    { value: "3day", label: "3-Day", className: "flex md:hidden" },
    { value: "day", label: "Day" },
    { value: "schedule", label: "Schedule" },
  ];

  const renderDateLabel = () => {
    switch (view) {
      case "year":
        return format(currentDate, "yyyy");
      case "month":
        return (
          <>
            <span className="md:hidden">{format(currentDate, "MMM yyyy")}</span>
            <span className="hidden md:inline">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </>
        );
      case "week":
      case "3day":
      case "4day":
        return format(currentDate, "MMM yyyy");
      case "day":
        return (
          <>
            <span className="md:hidden">{format(currentDate, "MMM d")}</span>
            <span className="hidden md:inline">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </span>
          </>
        );
      case "schedule":
        return "Schedule";
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between gap-1 px-4 py-3 border-b bg-background/60 backdrop-blur-xl sticky top-0 z-20 shadow-sm overflow-hidden overscroll-x-none",
        "h-[60px] md:h-[68px]",
        className,
      )}
    >
      {/* Left Cluster: Navigation on desktop / Nav Cluster on mobile */}
      <div
        className={cn("flex-initial md:flex-1 flex items-center gap-2 min-w-0")}
      >
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="default"
            onClick={() => {
              trigger("tick");
              goToToday();
            }}
            className="h-9 bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none transition-seijaku-fast text-[13px] font-medium rounded-lg px-3"
          >
            <CalendarIcon className="h-4 w-4 mr-2" strokeWidth={2.25} />
            <span>Today</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shadow-none transition-seijaku-fast rounded-full"
              onClick={() => {
                trigger("tick");
                prev();
              }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shadow-none transition-seijaku-fast rounded-full"
              onClick={() => {
                trigger("tick");
                next();
              }}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation - Only show Today button as swipe is enabled */}
        <div className="flex md:hidden items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none transition-seijaku-fast rounded-lg"
            onClick={() => {
              trigger("tick");
              goToToday();
            }}
          >
            <CalendarIcon className="h-4 w-4" strokeWidth={2.25} />
          </Button>
        </div>
      </div>

      {/* Middle: Date Label - Centered between clusters on mobile, absolute on desktop */}
      <div
        className={cn(
          "md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "flex-1 md:flex-none flex items-center justify-center min-w-0 px-2 z-10 pointer-events-none",
        )}
      >
        <div
          className={cn(
            "font-semibold tracking-tight truncate",
            "text-base font-bold md:text-[28px] md:tracking-[-0.03em] md:font-semibold",
          )}
        >
          {renderDateLabel()}
        </div>
      </div>

      {/* Right Cluster: View Select + Menu */}
      <div className="flex-initial md:flex-1 flex items-center gap-1 md:gap-1.5 min-w-0 justify-end">
        <Select
          value={view}
          onValueChange={(v) => {
            trigger("toggle");
            setView(v as CalendarView);
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 text-[13px] px-2 md:px-3 font-medium bg-secondary/40 border-border/50 shadow-none hover:bg-secondary/60 transition-seijaku-fast shrink-0 rounded-lg",
              "w-[94px] md:w-[110px]",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0 shadow-none border-border/80">
            {availableViews.map((viewOption) => (
              <SelectItem
                key={viewOption.value}
                value={viewOption.value}
                className={cn("text-[13px] pr-6", viewOption.className)}
              >
                {viewOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Desktop Right Menu Items */}
        <div className="hidden md:flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              trigger("toggle");
            }}
            className="h-9 w-9 p-0 items-center justify-center bg-secondary/40 hover:bg-secondary/60 border border-border/50 shadow-none rounded-lg"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2.25} />
          </Button>

          <Button
            size="sm"
            onClick={() => {
              trigger("tick");
              onCreateEvent();
            }}
            className="h-9 items-center gap-2 px-4 rounded-lg bg-brand text-brand-foreground hover:bg-brand/90 border-none shadow-sm shadow-brand/10 transition-seijaku shrink-0 text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            <span>New Event</span>
          </Button>
        </div>

        <ImportExportMenu events={events} />
      </div>
    </div>
  );
}
