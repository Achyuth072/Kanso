"use client";

import { format, startOfDay, addDays } from "date-fns";
import { useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";

interface ScheduleViewProps {
  events: CalendarEvent[];
  startDate: Date;
  daysToShow?: number; // How many days ahead to show
  className?: string;
}

const ScheduleView = memo(
  ({ events, startDate, daysToShow = 30, className }: ScheduleViewProps) => {
    const { formatTime } = useTimeFormat();
    const startOfToday = startOfDay(startDate);

    // Memoize date range generation
    const dateRange = useMemo(
      () =>
        Array.from({ length: daysToShow }).map((_, i) =>
          addDays(startOfToday, i),
        ),
      [startOfToday, daysToShow],
    );

    // Memoize event grouping by day
    const eventsByDay = useMemo(() => {
      const map = new Map<string, CalendarEvent[]>();

      events
        .filter((event) => startOfDay(event.start) >= startOfToday)
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .forEach((event) => {
          const dayKey = format(startOfDay(event.start), "yyyy-MM-dd");
          if (!map.has(dayKey)) {
            map.set(dayKey, []);
          }
          map.get(dayKey)!.push(event);
        });
      return map;
    }, [events, startOfToday]);

    const todayStr = format(new Date(), "yyyy-MM-dd");

    return (
      <div className={cn("h-full overflow-auto p-6", className)}>
        <div className="max-w-3xl mx-auto space-y-6">
          {dateRange.map((date) => {
            const dayKey = format(date, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dayKey) || [];
            const isToday = dayKey === todayStr;

            return (
              <div key={dayKey} className="space-y-2">
                {/* Date Header */}
                <div
                  className={cn(
                    "sticky top-0 z-10 bg-background/95 backdrop-blur-sm",
                    "py-4 border-b border-border/40",
                  )}
                >
                  <div className="flex items-baseline gap-3">
                    <div
                      className={cn(
                        "text-3xl font-bold px-2 rounded-lg min-w-[2.5rem] h-10 flex items-center justify-center",
                        isToday && "text-white bg-brand shadow-sm",
                      )}
                    >
                      {format(date, "d")}
                    </div>
                    <div className="flex flex-col">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isToday && "text-brand",
                        )}
                      >
                        {format(date, "EEEE")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(date, "MMMM yyyy")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Events for this day */}
                <div className="space-y-2 pl-2">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "flex gap-4 p-4 rounded-xl hover:bg-accent/30 cursor-pointer transition-all active:scale-[0.99] mb-2",
                          "bg-(--event-color)/15 font-medium border-l-4 border-(--event-color)",
                        )}
                        style={
                          {
                            "--event-color":
                              event.color || "hsl(var(--primary))",
                          } as React.CSSProperties
                        }
                      >
                        {/* Time */}
                        <div className="shrink-0 w-20 text-sm text-muted-foreground">
                          {event.allDay ? (
                            "All day"
                          ) : (
                            <>
                              <div>{formatTime(event.start)}</div>
                              {event.end && (
                                <div className="text-xs">
                                  {formatTime(event.end)}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {event.title}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No events
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

ScheduleView.displayName = "ScheduleView";

export { ScheduleView };
