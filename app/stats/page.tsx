import { StatsClient } from "@/components/stats/StatsClient";

// Performance: Root stats page is now a Server Component (PERF-01).
export default function StatsPage() {
  return <StatsClient />;
}
