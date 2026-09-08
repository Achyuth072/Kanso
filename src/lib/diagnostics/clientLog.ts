import * as Sentry from "@sentry/nextjs";

export interface DiagnosticLogEntry {
  timestamp: string;
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
}

// Sentry breadcrumbs are pre-scrubbed by beforeBreadcrumb to exclude user content.
export function getRecentClientLogs(limit = 50): DiagnosticLogEntry[] {
  const breadcrumbs = Sentry.getIsolationScope().getScopeData().breadcrumbs;
  return breadcrumbs.slice(-limit).map((crumb) => ({
    timestamp: new Date((crumb.timestamp ?? 0) * 1000).toISOString(),
    category: crumb.category,
    level: crumb.level,
    message: crumb.message,
    data: crumb.data,
  }));
}
