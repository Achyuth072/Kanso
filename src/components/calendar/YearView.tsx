"use client";

import { addMonths, startOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useMemo, memo } from "react";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { useCalendarStore } from "@/lib/calendar/store";
import type { DayButtonProps } from "react-day-picker";

interface YearViewProps {
  currentYear: number;
  onDateClick?: (date: Date) => void;
  className?: string;
}

const YearDayButton = ({
  day,
  modifiers,
  className,
  ...props
}: DayButtonProps) => {
  const isToday = modifiers.today;

  return (
    <button
      {...props}
      className={cn(
        "h-8 w-8 p-0 font-bold rounded-lg transition-all flex items-center justify-center relative select-none",
        "hover:bg-brand/10 hover:text-foreground text-muted-foreground/80",
        isToday &&
          "bg-brand text-white !opacity-100 shadow-sm hover:!bg-brand/90 hover:!text-white",
        className,
      )}
    >
      {day.date.getDate()}
    </button>
  );
};

const YearMonth = memo(
  ({
    monthDate,
    onDateClick,
  }: {
    monthDate: Date;
    onDateClick?: (date: Date) => void;
  }) => {
    return (
      <div className="flex justify-center">
        <Calendar
          mode="single"
          month={monthDate}
          selected={undefined}
          onSelect={(date) => date && onDateClick?.(date)}
          showOutsideDays={false}
          className="p-0 select-none [--cell-size:32px]"
          classNames={{
            months: "flex flex-col",
            month: "space-y-3",
            nav: "hidden",
            caption:
              "flex justify-center pt-2 relative items-center text-sm font-bold tracking-tight text-foreground mb-1",
            head_row: "flex gap-1 mb-1",
            head_cell:
              "text-muted-foreground/40 w-8 font-bold text-[0.65rem] uppercase tracking-tighter",
            row: "flex w-full gap-1",
            cell: "relative p-0 text-center text-xs focus-within:relative focus-within:z-20",
            outside: "invisible",
            disabled: "text-muted-foreground opacity-20",
          }}
          components={{
            DayButton: YearDayButton,
          }}
        />
      </div>
    );
  },
);

YearMonth.displayName = "YearMonth";

const YearView = memo(
  ({ currentYear, onDateClick, className }: YearViewProps) => {
    const { next, prev } = useCalendarStore();
    const swipeHandlers = useSwipe({
      onSwipeLeft: () => next(),
      onSwipeRight: () => prev(),
    });

    const start = useMemo(
      () => startOfYear(new Date(currentYear, 0, 1)),
      [currentYear],
    );

    return (
      <div
        {...swipeHandlers}
        className={cn("h-full overflow-y-auto bg-background", className)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-8 p-8 max-w-7xl mx-auto">
          {Array.from({ length: 12 }).map((_, i) => (
            <YearMonth
              key={i}
              monthDate={addMonths(start, i)}
              onDateClick={onDateClick}
            />
          ))}
        </div>
      </div>
    );
  },
);

YearView.displayName = "YearView";

export { YearView };
