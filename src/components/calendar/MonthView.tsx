"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";
import { EventOverflowPopover } from "./EventOverflowPopover";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useCalendarStore } from "@/lib/calendar/store";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  "data-testid"?: string;
}

interface MonthDayCellProps {
  day: Date;
  dayEvents: CalendarEvent[];
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  isCompact?: boolean;
  onDateClick?: (date: Date) => void;
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

const MonthDayCell = memo(
  ({
    day,
    dayEvents,
    isCurrentMonth,
    isCurrentDay,
    isCompact,
    onDateClick,
    onDateNumberClick,
    onEventClick,
  }: MonthDayCellProps) => {
    const isMobile = useIsMobile();
    const { formatTime } = useTimeFormat();
    // Dynamic limit based on available vertical space
    const maxLimit = isMobile ? (isCompact ? 2 : 3) : isCompact ? 3 : 4;

    // Ensure total items (events + overflow label) does not exceed maxLimit
    const maxVisible = dayEvents.length > maxLimit ? maxLimit - 1 : maxLimit;

    const visibleEvents = dayEvents.slice(0, maxVisible);
    const remainingCount = dayEvents.length - maxVisible;

    return (
      <div
        onClick={() => onDateClick?.(day)}
        className={cn(
          "relative p-0.5 pb-0.5 md:p-2 md:pb-1 flex flex-col h-full min-h-16 md:min-h-21",
          "cursor-pointer transition-colors overflow-hidden",
          isCompact && "p-0.5 md:p-1 md:pb-0.5",
          !isCurrentMonth && "bg-muted/5 opacity-40",
          isCurrentDay ? "bg-brand/10" : "hover:bg-accent/30",
        )}
      >
        {/* Date number */}
        <div className="flex items-center justify-between mb-1 md:mb-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDateNumberClick?.(day);
            }}
            className={cn(
              "text-xs md:text-sm font-bold transition-all hover:bg-brand/10",
              "w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-lg",
              isCompact && "w-5 h-5 md:w-6 md:h-6 text-[10px] md:text-xs",
              isCurrentDay && "bg-brand text-white shadow-sm hover:bg-brand/90",
              !isCurrentMonth && "text-muted-foreground/50",
            )}
          >
            {format(day, "d")}
          </button>
        </div>

        <div className="flex-1 min-h-0 relative z-10 flex flex-col">
          <div
            className={cn(
              "space-y-0.5 md:space-y-1 overflow-hidden shrink min-h-0",
              isMobile && "space-y-[1px]",
            )}
          >
            {visibleEvents.map((event) => {
              const isTask = event.category === "task";
              return (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  className={cn(
                    "text-[10px] md:text-[11px] px-1 md:px-2 py-0.5 mx-[1px] md:mx-0 rounded-sm truncate font-semibold leading-tight hover:brightness-95 transition-all cursor-pointer",
                    isTask
                      ? "bg-brand/8 border-t border-t-border/40 border-r border-r-border/40 border-b border-b-border/40 text-foreground"
                      : "bg-brand text-white",
                  )}
                  style={{
                    ...(isTask && {
                      borderLeftColor: event.color || "#4B6CB7",
                      borderLeftWidth: "3px",
                    }),
                  }}
                  title={event.title}
                >
                  <span className="hidden md:inline">
                    {formatTime(event.start)}{" "}
                  </span>
                  {event.title}
                </div>
              );
            })}
          </div>
          {remainingCount > 0 && (
            <div className={cn("shrink-0", isMobile ? "mt-0.5" : "mt-1")}>
              <EventOverflowPopover
                remainingEvents={dayEvents.slice(maxVisible)}
                day={day}
                onEventClick={onEventClick}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
);

MonthDayCell.displayName = "MonthDayCell";

const MonthView = memo(
  ({
    currentDate,
    events,
    onDateClick,
    onDateNumberClick,
    onEventClick,
    className,
    "data-testid": testId,
  }: MonthViewProps) => {
    const { next, prev } = useCalendarStore();
    const swipeHandlers = useSwipe({
      onSwipeLeft: () => next(),
      onSwipeRight: () => prev(),
    });

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Calculate number of weeks (rows) needed
    const numWeeks = Math.ceil(days.length / 7);

    // Memoize event grouping to avoid recalculating on every render
    const eventsByDay = useMemo(() => {
      const map = new Map<string, CalendarEvent[]>();
      events.forEach((event) => {
        const dayKey = format(event.start, "yyyy-MM-dd");
        if (!map.has(dayKey)) {
          map.set(dayKey, []);
        }
        map.get(dayKey)!.push(event);
      });
      return map;
    }, [events]);

    return (
      <div
        data-testid={testId}
        {...swipeHandlers}
        className={cn(
          "h-full flex flex-col overflow-hidden bg-background",
          className,
        )}
      >
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-border/40">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className={cn(
            "flex-1 min-h-0 grid grid-cols-7 overflow-y-auto md:overflow-hidden divide-x divide-border/40 divide-y divide-border/40 border-b border-r border-border/40",
          )}
          style={{ gridTemplateRows: `repeat(${numWeeks}, 1fr)` }}
        >
          {days.map((day) => (
            <MonthDayCell
              key={format(day, "yyyy-MM-dd")}
              day={day}
              dayEvents={eventsByDay.get(format(day, "yyyy-MM-dd")) || []}
              isCurrentMonth={isSameMonth(day, currentDate)}
              isCurrentDay={isToday(day)}
              isCompact={numWeeks === 6}
              onDateClick={onDateClick}
              onDateNumberClick={onDateNumberClick}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </div>
    );
  },
);

MonthView.displayName = "MonthView";

export { MonthView };
