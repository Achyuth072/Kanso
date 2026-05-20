import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCalendarStore } from "@/lib/calendar/store";
import { useEffect, useMemo } from "react";
import type { CalendarEventUI } from "@/lib/calendar/types";
import { toCalendarEventUI } from "@/lib/types/calendar-event";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

export function useCalendarEvents() {
  const setEvents = useCalendarStore((state) => state.setEvents);
  const { isGuestMode } = useAuth();

  // 1. Fetch Dedicated Calendar Events
  const { data: dedicatedEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["calendar-events", isGuestMode],
    queryFn: async () => {
      if (isGuestMode) return mockStore.getEvents();

      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("is_archived", false);

      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch Tasks as Events
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["calendar-tasks", isGuestMode],
    queryFn: async () => {
      // Guest Mode
      if (isGuestMode) {
        const allTasks = mockStore.getTasks();
        const allProjects = mockStore.getProjects();
        const projectMap = new Map(allProjects.map((p) => [p.id, p]));

        return allTasks
          .filter((t) => t.due_date)
          .map((t) => ({
            id: t.id,
            content: t.content,
            due_date: t.due_date!,
            project_id: t.project_id,
            projects: t.project_id
              ? {
                  color:
                    projectMap.get(t.project_id)?.color ||
                    "hsl(var(--primary))",
                }
              : null,
          }));
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
          id,
          content,
          due_date,
          project_id,
          projects (
            color
          )
        `,
        )
        .not("due_date", "is", null);

      if (error) throw error;
      return data;
    },
  });

  // Define the shape of the data returned by Supabase tasks select
  type CalendarTaskData = {
    id: string;
    content: string;
    due_date: string;
    project_id: string | null;
    projects: { color: string } | { color: string }[] | null;
  };

  // Memoize the transformation and merging
  const calendarEvents = useMemo(() => {
    const results: CalendarEventUI[] = [];

    // Map dedicated events
    if (dedicatedEvents) {
      dedicatedEvents.forEach((e) => results.push(toCalendarEventUI(e)));
    }

    // Map tasks
    if (tasks) {
      (tasks as unknown as CalendarTaskData[]).forEach((task) => {
        const startDate = new Date(task.due_date);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        results.push({
          id: task.id,
          title: task.content,
          start: startDate,
          end: endDate,
          allDay: false, // Tasks are always timed by default
          color:
            (Array.isArray(task.projects)
              ? task.projects[0]?.color
              : task.projects?.color) || "hsl(var(--primary))",
          category: "task",
        });
      });
    }

    return results;
  }, [dedicatedEvents, tasks]);

  useEffect(() => {
    setEvents(calendarEvents);
  }, [calendarEvents, setEvents]);

  return { isLoading: eventsLoading || tasksLoading };
}
