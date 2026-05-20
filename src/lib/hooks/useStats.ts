import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { subDays, format } from "date-fns";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";

export interface DailyStats {
  date: string;
  hours: number;
  totalSessions: number;
  tasksCompleted: number;
}

export interface StatsTrend {
  value: number;
  isPositive: boolean;
}

export interface StatsData {
  totalFocusHours: number;
  totalSessions: number;
  tasksCompleted: number;
  completionRate: number;
  currentStreak: number;
  dailyTrend: DailyStats[];
  habitReps: number;
  trends: {
    focus: StatsTrend;
    tasks: StatsTrend;
    rate: StatsTrend;
    habitReps: StatsTrend;
  };
}

/**
 * Processes raw stats data in a single pass to optimize performance.
 * Goal: Iteration time < 5ms for 1,000 tasks.
 */
export function calculateStats(
  logs: { start_time: string; duration_seconds: number | null }[],
  tasks: { is_completed: boolean; completed_at: string | null }[],
  habitEntries: { date: string }[],
): StatsData {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const fourteenDaysAgo = subDays(now, 14);
  const sevenDaysAgoMs = sevenDaysAgo.getTime();
  const fourteenDaysAgoMs = fourteenDaysAgo.getTime();

  // Pre-allocate daily trend structure for the last 7 days
  const dailyTrend: DailyStats[] = [];
  const dailyTrendMap: Record<string, number> = {};

  for (let i = 6; i >= 0; i--) {
    const date = subDays(now, i);
    const key = date.toISOString().split("T")[0];
    dailyTrendMap[key] = dailyTrend.length;
    dailyTrend.push({
      date: format(date, "EEE"),
      hours: 0,
      totalSessions: 0,
      tasksCompleted: 0,
    });
  }

  const activityDates = new Set<string>();

  // 1. Process Focus Logs
  let totalFocusSeconds = 0;
  let currentFocusSec = 0;
  let prevFocusSec = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const seconds = log.duration_seconds || 0;
    totalFocusSeconds += seconds;

    const startTimeMs = Date.parse(log.start_time);
    if (startTimeMs >= sevenDaysAgoMs) {
      currentFocusSec += seconds;
    } else if (startTimeMs >= fourteenDaysAgoMs) {
      prevFocusSec += seconds;
    }

    const dateKey = log.start_time.split("T")[0];
    activityDates.add(dateKey);

    const trendIdx = dailyTrendMap[dateKey];
    if (trendIdx !== undefined) {
      dailyTrend[trendIdx].hours += seconds / 3600;
      dailyTrend[trendIdx].totalSessions += 1;
    }
  }

  // 2. Process Tasks
  let completedTasksCount = 0;
  let currentCompleted = 0;
  let prevCompleted = 0;
  let currentTotal = 0;
  let prevTotal = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.is_completed) {
      completedTasksCount++;
      if (task.completed_at) {
        const completedAtMs = Date.parse(task.completed_at);
        if (completedAtMs >= sevenDaysAgoMs) {
          currentCompleted++;
          currentTotal++;
        } else if (completedAtMs >= fourteenDaysAgoMs) {
          prevCompleted++;
          prevTotal++;
        }

        const dateKey = task.completed_at.split("T")[0];
        activityDates.add(dateKey);

        const trendIdx = dailyTrendMap[dateKey];
        if (trendIdx !== undefined) {
          dailyTrend[trendIdx].tasksCompleted += 1;
        }
      }
    } else {
      currentTotal++;
    }
  }

  // 3. Process Habit Entries
  let currentHabitReps = 0;
  let prevHabitReps = 0;
  for (let i = 0; i < habitEntries.length; i++) {
    const entry = habitEntries[i];
    const entryMs = Date.parse(entry.date);
    if (entryMs >= sevenDaysAgoMs) {
      currentHabitReps++;
    } else if (entryMs >= fourteenDaysAgoMs) {
      prevHabitReps++;
    }
  }

  // 4. Calculate Streak
  let currentStreak = 0;
  if (activityDates.size > 0) {
    const checkDate = new Date(now);
    const getDateKey = (d: Date) => d.toISOString().split("T")[0];

    // If no activity today, check yesterday
    if (!activityDates.has(getDateKey(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (activityDates.has(getDateKey(checkDate))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      if (currentStreak > 365) break; // Safety break
    }
  }

  // Helper for trend calculation
  const calculateTrend = (curr: number, prev: number): StatsTrend => {
    if (prev === 0) return { value: curr > 0 ? 100 : 0, isPositive: curr > 0 };
    const diff = ((curr - prev) / prev) * 100;
    return {
      value: Math.abs(Math.round(diff * 10) / 10),
      isPositive: diff >= 0,
    };
  };

  // Final rounding for daily trend
  for (let i = 0; i < dailyTrend.length; i++) {
    dailyTrend[i].hours = Math.round(dailyTrend[i].hours * 10) / 10;
  }

  const currentRate =
    currentTotal > 0 ? (currentCompleted / currentTotal) * 100 : 0;
  const prevRate = prevTotal > 0 ? (prevCompleted / prevTotal) * 100 : 0;

  return {
    totalFocusHours: Math.round((totalFocusSeconds / 3600) * 10) / 10,
    totalSessions: logs.length,
    tasksCompleted: completedTasksCount,
    completionRate:
      tasks.length > 0
        ? Math.round((completedTasksCount / tasks.length) * 100)
        : 0,
    currentStreak,
    dailyTrend,
    habitReps: habitEntries.length,
    trends: {
      focus: calculateTrend(currentFocusSec, prevFocusSec),
      tasks: calculateTrend(currentCompleted, prevCompleted),
      rate: calculateTrend(currentRate, prevRate),
      habitReps: calculateTrend(currentHabitReps, prevHabitReps),
    },
  };
}

export function useStats() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["stats-dashboard", isGuestMode],
    staleTime: 60000, // Cache for 1 minute
    queryFn: async (): Promise<StatsData> => {
      let rawLogs, rawTasks, rawHabits;

      if (isGuestMode) {
        rawLogs = mockStore.getFocusLogs();
        rawTasks = mockStore.getTasks();
        rawHabits = mockStore.getHabitEntries();
      } else {
        const supabase = createClient();
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        // Parallel fetch for better performance
        const [logsRes, tasksRes, habitsRes] = await Promise.all([
          supabase
            .from("focus_logs")
            .select("start_time, duration_seconds")
            .gte("start_time", thirtyDaysAgo),
          supabase.auth.getSession().then(({ data: { session } }) => {
            const userId = session?.user?.id;
            if (!userId) throw new Error("Not authenticated");
            return supabase
              .from("tasks")
              .select("is_completed, completed_at, user_id")
              .eq("user_id", userId);
          }),
          supabase
            .from("habit_entries")
            .select("date")
            .gte("date", thirtyDaysAgo),
        ]);

        if (logsRes.error) throw logsRes.error;
        if (tasksRes.error) throw tasksRes.error;
        if (habitsRes.error) throw habitsRes.error;

        rawLogs = logsRes.data || [];
        rawTasks = tasksRes.data || [];
        rawHabits = habitsRes.data || [];
      }

      return calculateStats(rawLogs, rawTasks, rawHabits);
    },
  });
}
