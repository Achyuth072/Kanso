"use client";

import { memo } from "react";
import { format } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { cn } from "@/lib/utils";

interface EventOverflowPopoverProps {
  remainingEvents: CalendarEvent[];
  day: Date;
  onEventClick?: (event: CalendarEvent) => void;
}

export const EventOverflowPopover = memo(
  ({ remainingEvents, day, onEventClick }: EventOverflowPopoverProps) => {
    const { trigger } = useHaptic();
    const { formatTime } = useTimeFormat();

    if (remainingEvents.length === 0) return null;

    return (
      <Popover modal={true}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              trigger("toggle"); // Toggle haptic
            }}
            className="text-[10px] md:text-xs text-muted-foreground px-1 md:px-2 hover:text-foreground transition-colors text-left"
          >
            +{remainingEvents.length} more
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3 bg-popover/95 backdrop-blur-md border-border/40 shadow-xl"
          align="start"
          collisionPadding={16}
          onEscapeKeyDown={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20 pb-2">
              {format(day, "EEE, MMM d")}
            </h4>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
              {remainingEvents.map((event) => {
                const isTask = event.category === "task";
                return (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className={cn(
                      "group flex flex-col gap-0.5 p-2 rounded-lg transition-all cursor-pointer",
                      isTask
                        ? "bg-brand/8 border-t border-t-border/40 border-r border-r-border/40 border-b border-b-border/40 hover:bg-brand/12"
                        : "bg-brand text-white hover:brightness-110",
                    )}
                    style={{
                      ...(isTask && {
                        borderLeftColor: event.color || "#4B6CB7",
                        borderLeftWidth: "3px",
                      }),
                    }}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-bold truncate",
                        isTask ? "text-foreground" : "text-white",
                      )}
                    >
                      {event.title}
                    </span>
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <span
                        className={cn(
                          "text-[10px] font-medium shrink-0",
                          isTask ? "text-muted-foreground" : "text-white/80",
                        )}
                      >
                        {formatTime(event.start)}
                      </span>
                      {event.location && (
                        <span
                          className={cn(
                            "text-[9px] truncate flex items-center gap-0.5",
                            isTask
                              ? "text-muted-foreground/60"
                              : "text-white/70",
                          )}
                        >
                          <span>📍</span>
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

EventOverflowPopover.displayName = "EventOverflowPopover";
