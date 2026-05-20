"use client";

import { format, isSameDay } from "date-fns";
import { useMemo, memo, useEffect, useRef } from "react";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useCalendarStore } from "@/lib/calendar/store";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { cn } from "@/lib/utils";
import { getDayRange, layoutDayRange } from "@/lib/calendar/engine";
import type { CalendarEvent } from "@/lib/calendar/types";
import { CurrentTimeIndicator } from "./CurrentTimeIndicator";

const HOUR_HEIGHT = 120; // 60 minutes * 2 pixels

interface TimeGridProps {
  isMobile?: boolean;
  startDate: Date;
  daysToShow: number; // 1 for Day, 3 for Mobile, 4 for Desktop, 7 for Week
  events: CalendarEvent[];
  onDateNumberClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  "data-testid"?: string;
}

export function TimeGrid({
  isMobile = false,
  startDate,
  daysToShow,
  events,
  onDateNumberClick,
  onEventClick,
  className,
  "data-testid": testId,
}: TimeGridProps) {
  const { next, prev } = useCalendarStore();
  const { formatTime } = useTimeFormat();
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
  });

  const dates = getDayRange(startDate, daysToShow);

  // Memoize expensive layout calculations
  const columns = useMemo(() => layoutDayRange(events, dates), [events, dates]);
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  // Responsive column sizing logic
  const gridTemplateColumns = useMemo(() => {
    // On mobile, if showing more than 3 days (Week view),
    // force each column to 33.33% to show 3 days at a time with scroll
    if (isMobile && daysToShow > 3) {
      return `repeat(${daysToShow}, 33.3333%)`;
    }
    return `repeat(${daysToShow}, 1fr)`;
  }, [isMobile, daysToShow]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Vertical scroll position
      const scrollPos =
        currentHour * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollPos - 120);

      // Horizontal scroll (Mobile Week View)
      if (isMobile && daysToShow > 3) {
        const todayIndex = dates.findIndex((d) => isSameDay(d, now));
        if (todayIndex > 0) {
          const containerWidth = scrollRef.current.clientWidth;
          // Each column is 33.3333% of the container width
          const columnWidth = containerWidth / 3;
          scrollRef.current.scrollLeft = todayIndex * columnWidth;
        }
      }
    }
  }, [dates, isMobile, daysToShow]);

  return (
    <div
      ref={scrollRef}
      {...swipeHandlers}
      data-testid={testId || "time-grid"}
      className={cn(
        "flex h-full overflow-auto bg-background custom-scrollbar",
        "scroll-pl-12 md:scroll-pl-16",
        isMobile && "snap-x snap-mandatory",
        className,
      )}
    >
      {/* Time Labels Column */}
      <div className="w-12 md:w-16 flex-shrink-0 sticky left-0 z-50 bg-background border-r border-border/40 h-fit">
        <div className="h-16 bg-background" />{" "}
        {/* Spacer for header - ensured background */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="text-[9px] md:text-xs text-muted-foreground/50 text-right pr-2 md:pr-3 pt-2 font-medium bg-background"
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            {format(new Date().setHours(hour, 0), "h a")}
          </div>
        ))}
      </div>

      {/* Days Columns */}
      <div
        className="flex-1 grid divide-x divide-border/40 h-fit"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => {
          const isToday = isSameDay(column.date, new Date());

          return (
            <div
              key={column.date.toString()}
              className={cn(
                "relative min-w-0 md:min-w-[120px]",
                isMobile && "snap-start",
                isToday && "bg-brand/[0.09]",
              )}
            >
              {/* Header for the Day - z-40 to be above events (10) and indicator (30) */}
              <div className="sticky top-0 z-40 bg-background border-b border-border/40 h-20 flex flex-col items-center justify-center gap-1">
                <div
                  className={cn(
                    "text-[10px] md:text-xs uppercase tracking-wider",
                    isToday
                      ? "text-brand font-bold"
                      : "text-muted-foreground/70 font-medium",
                  )}
                >
                  {format(column.date, "EEE")}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateNumberClick?.(column.date);
                  }}
                  className={cn(
                    "text-lg md:text-xl font-bold inline-flex items-center justify-center transition-all",
                    "hover:bg-brand/10 rounded-lg w-9 h-9 md:w-11 md:h-11",
                    isToday &&
                      "bg-brand text-white shadow-sm hover:bg-brand/90",
                  )}
                >
                  {format(column.date, "d")}
                </button>
              </div>

              {/* The Grid Lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-t border-border/40"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Current Time Indicator */}
              {isToday && <CurrentTimeIndicator />}

              {/* Render Events for this Day */}
              {column.events.map((event) => {
                const topPx = (event.top / 100) * (24 * HOUR_HEIGHT);
                const heightPx = (event.height / 100) * (24 * HOUR_HEIGHT);
                const isTask = event.category === "task";

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "absolute rounded-sm px-1 md:px-2 py-1 text-[10px] md:text-xs cursor-pointer overflow-hidden flex flex-col gap-0.5",
                      "z-10 hover:z-20 hover:brightness-95 active:scale-[0.98] transition-all",
                      isTask
                        ? "bg-brand/8 border-t border-t-border/40 border-r border-r-border/40 border-b border-b-border/40 text-foreground"
                        : "bg-brand/90 text-white border-l-2 border-brand",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    style={{
                      top: `${topPx + 64}px`, // +64px for h-16 header height
                      height: `${Math.max(heightPx, 24)}px`, // Minimum 24px height
                      left: "1px",
                      right: "1px",
                      width: "calc(100% - 2px)",
                      ...(isTask && {
                        borderLeftColor: event.color || "#4B6CB7",
                        borderLeftWidth: "4px",
                      }),
                    }}
                  >
                    {/* Title */}
                    <div className="font-bold truncate text-[10px] md:text-[11px] leading-tight">
                      {event.title}
                    </div>

                    {/* Time & Location - Only show if enough height */}
                    {heightPx > 40 && (
                      <div className="flex flex-col gap-0.5">
                        <div
                          className={cn(
                            "text-[9px] md:text-[10px] leading-tight font-medium",
                            isTask
                              ? "text-muted-foreground/70"
                              : "text-white/80",
                          )}
                        >
                          {formatTime(event.start)}
                        </div>
                        {heightPx > 60 && event.location && (
                          <div
                            className={cn(
                              "text-[8px] md:text-[9px] leading-tight flex items-center gap-0.5 mt-0.5",
                              isTask
                                ? "text-muted-foreground/60"
                                : "text-white/70",
                            )}
                          >
                            <span className="shrink-0 opacity-80">📍</span>
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(TimeGrid);
