import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import { subDays, eachDayOfInterval, format } from "date-fns";

export type MetricType = "combined" | "focus" | "tasks";

export interface HeatmapDataPoint {
  date: string; // ISO date 'YYYY-MM-DD'
  combined: number;
  focus: number; // in hours
  tasks: number; // count
}

export interface UseHeatmapDataReturn {
  data: HeatmapDataPoint[];
  isLoading: boolean;
  maxValue: Record<MetricType, number>;
  totalDays: number;
  activeDays: number;
}

/**
 * Hook to fetch and process data for the Visual Activity Heatmap.
 * Returns activity data for the past 365 days.
 */
export function useHeatmapData(): UseHeatmapDataReturn {
  const { isGuestMode } = useAuth();

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["heatmap-data", isGuestMode],
    staleTime: 300000, // 5 minutes (mock data is static)
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 365).toISOString();

      if (isGuestMode) {
        return {
          focusLogs: mockStore
            .getFocusLogs()
            .filter((log) => log.start_time >= thirtyDaysAgo),
          tasks: mockStore
            .getTasks()
            .filter(
              (task) =>
                task.is_completed &&
                task.completed_at &&
                task.completed_at >= thirtyDaysAgo,
            ),
        };
      }

      const supabase = createClient();
      const [focusRes, tasksRes] = await Promise.all([
        supabase
          .from("focus_logs")
          .select("start_time, duration_seconds")
          .gte("start_time", thirtyDaysAgo),
        supabase
          .from("tasks")
          .select("completed_at")
          .eq("is_completed", true)
          .gte("completed_at", thirtyDaysAgo),
      ]);

      return {
        focusLogs: focusRes.data || [],
        tasks: tasksRes.data || [],
      };
    },
  });

  // Process data into 365 days interval
  const processedData = useMemo(() => {
    if (!rawData && !isLoading) return [];
    if (!rawData) return [];

    const endDate = new Date();
    const startDate = subDays(endDate, 364);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Pre-aggregate data into a dictionary for O(1) daily lookup
    const dailyStats: Record<string, { focusSeconds: number; tasks: number }> =
      {};

    // Process Focus Logs (O(N))
    rawData.focusLogs.forEach((log) => {
      // Extract YYYY-MM-DD from start_time string (assumes ISO format)
      const dateStr = log.start_time.split("T")[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { focusSeconds: 0, tasks: 0 };
      }
      dailyStats[dateStr].focusSeconds += log.duration_seconds || 0;
    });

    // Process Tasks (O(M))
    rawData.tasks.forEach((task) => {
      if (!task.completed_at) return;
      const dateStr = task.completed_at.split("T")[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { focusSeconds: 0, tasks: 0 };
      }
      dailyStats[dateStr].tasks += 1;
    });

    // Generate processed days (O(365))
    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const stats = dailyStats[dateStr] || { focusSeconds: 0, tasks: 0 };

      const focusHours = parseFloat((stats.focusSeconds / 3600).toFixed(2));
      const dayTasks = stats.tasks;

      // Combined score logic
      const combined = parseFloat((focusHours + dayTasks * 0.5).toFixed(2));

      return {
        date: dateStr,
        combined,
        focus: focusHours,
        tasks: dayTasks,
      };
    });
  }, [rawData, isLoading]);

  // Calculate max values and active days from the memoized data
  const { maxValue, activeDays } = useMemo(() => {
    const initialMax: Record<MetricType, number> = {
      combined: 1,
      focus: 1,
      tasks: 1,
    };

    if (processedData.length === 0) {
      return { maxValue: initialMax, activeDays: 0 };
    }

    let activeCount = 0;
    const max = { ...initialMax };

    processedData.forEach((d) => {
      if (d.combined > 0) activeCount++;
      if (d.combined > max.combined) max.combined = d.combined;
      if (d.focus > max.focus) max.focus = d.focus;
      if (d.tasks > max.tasks) max.tasks = d.tasks;
    });

    return { maxValue: max, activeDays: activeCount };
  }, [processedData]);

  return {
    data: processedData,
    isLoading,
    maxValue,
    totalDays: 365,
    activeDays,
  };
}
