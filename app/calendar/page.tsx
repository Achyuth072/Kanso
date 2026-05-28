"use client";

import { useEffect, useState, useCallback } from "react";
import { startOfWeek } from "date-fns";
import { useCalendarStore } from "@/lib/calendar/store";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { YearView } from "@/components/calendar/YearView";
import { MonthView } from "@/components/calendar/MonthView";
import { ScheduleView } from "@/components/calendar/ScheduleView";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import type { CalendarEventUI } from "@/lib/types/calendar-event";
import { useTask } from "@/lib/hooks/useTasks";
import TaskSheet from "@/components/tasks/TaskSheet";

export default function CalendarPage() {
  const { currentDate, view, events, setView, setDate, openCreateEvent } =
    useCalendarStore();
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const { data: fullTask } = useTask(selectedTaskId);

  // Fetch real events from Supabase
  useCalendarEvents();

  // Detect mobile/desktop for view switching
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Adjust view if mobile/desktop changes
  useEffect(() => {
    if (isMobile && (view === "4day" || view === "week")) {
      setView("3day");
    } else if (!isMobile && view === "3day") {
      setView("4day");
    }
  }, [isMobile, view, setView]);

  const handleDateClick = useCallback(
    (date: Date) => {
      openCreateEvent(date);
    },
    [openCreateEvent],
  );

  const handleDateNumberClick = useCallback(
    (date: Date) => {
      setDate(date);
      setView("day");
    },
    [setDate, setView],
  );

  const handleEventClick = useCallback(
    (event: CalendarEventUI) => {
      if (event.category === "task") {
        setSelectedTaskId(event.id);
      } else {
        openCreateEvent(undefined, event);
      }
    },
    [openCreateEvent],
  );

  const renderView = () => {
    switch (view) {
      case "year":
        return (
          <YearView
            currentYear={currentDate.getFullYear()}
            onDateClick={handleDateClick}
          />
        );

      case "day":
        return (
          <TimeGrid
            startDate={currentDate}
            daysToShow={1}
            events={events}
            onDateNumberClick={handleDateNumberClick}
            onEventClick={handleEventClick}
          />
        );

      case "3day":
        return (
          <TimeGrid
            startDate={currentDate}
            daysToShow={3}
            events={events}
            onDateNumberClick={handleDateNumberClick}
            onEventClick={handleEventClick}
          />
        );

      case "4day":
        return (
          <TimeGrid
            startDate={currentDate}
            daysToShow={4}
            events={events}
            onDateNumberClick={handleDateNumberClick}
            onEventClick={handleEventClick}
          />
        );

      case "week":
        return (
          <TimeGrid
            startDate={startOfWeek(currentDate)}
            daysToShow={7}
            events={events}
            onDateNumberClick={handleDateNumberClick}
            onEventClick={handleEventClick}
          />
        );

      case "schedule":
        return (
          <ScheduleView
            events={events}
            startDate={new Date()}
            daysToShow={30}
          />
        );

      case "month":
      default:
        return (
          <MonthView
            currentDate={currentDate}
            events={events}
            onDateClick={handleDateClick}
            onDateNumberClick={handleDateNumberClick}
            onEventClick={handleEventClick}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-124px)] md:h-dvh">
      <CalendarToolbar
        events={events}
        onCreateEvent={() => {
          openCreateEvent();
        }}
      />
      <div className="flex-1 min-h-0 relative">{renderView()}</div>

      <TaskSheet
        open={!!selectedTaskId && !!fullTask}
        onClose={() => setSelectedTaskId(null)}
        initialTask={fullTask || null}
      />
    </div>
  );
}
