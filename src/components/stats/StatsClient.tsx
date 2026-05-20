"use client";

import dynamic from "next/dynamic";
import { Target, CheckCircle2, Flame, Clock, Zap, Repeat } from "lucide-react";
import { MetricCard } from "@/components/stats/MetricCard";
import { useStats } from "@/lib/hooks/useStats";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load components (D3/Recharts are large)
const FocusTrendChart = dynamic(
  () =>
    import("@/components/stats/FocusTrendChart").then((mod) => ({
      default: mod.FocusTrendChart,
    })),
  {
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false,
  },
);

const ActivityHeatmap = dynamic(
  () =>
    import("@/components/stats/ActivityHeatmap").then((mod) => ({
      default: mod.ActivityHeatmap,
    })),
  {
    loading: () => <Skeleton className="h-48 w-full rounded-xl" />,
    ssr: false,
  },
);

export function StatsClient() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-28 md:h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const focusTrendData = stats?.dailyTrend || [];

  return (
    <div className="px-4 md:px-6 py-6 pb-12 md:pb-6 scrollbar-hide">
      <div className="space-y-6 md:space-y-8">
        <div>
          <h1 className="type-h1 text-2xl md:text-3xl">Statistics</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Track your productivity and progress
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          <MetricCard
            title="Total Focus"
            value={`${stats?.totalFocusHours || 0}h`}
            icon={Clock}
            trend={stats?.trends?.focus}
          />
          <MetricCard
            title="Sessions"
            value={stats?.totalSessions?.toString() || "0"}
            icon={Zap}
          />
          <MetricCard
            title="Tasks"
            value={stats?.tasksCompleted?.toString() || "0"}
            icon={CheckCircle2}
            trend={stats?.trends?.tasks}
          />
          <MetricCard
            title="Streak"
            value={`${stats?.currentStreak || 0}d`}
            icon={Flame}
          />
          <MetricCard
            title="Rate"
            value={`${stats?.completionRate || 0}%`}
            icon={Target}
            trend={stats?.trends?.rate}
          />
          <MetricCard
            title="Habits"
            value={stats?.habitReps?.toString() || "0"}
            icon={Repeat}
            trend={stats?.trends?.habitReps}
          />
        </div>

        <div>
          <FocusTrendChart data={focusTrendData} />
        </div>

        <div>
          <ActivityHeatmap />
        </div>
      </div>
    </div>
  );
}
