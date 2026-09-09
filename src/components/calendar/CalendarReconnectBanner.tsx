"use client";

import { TriangleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectedCalendarProviders } from "@/lib/hooks/useConnectedCalendarProviders";
import { capitalize } from "@/lib/utils";

// Auto-sync silently swallows token revocation, requiring a persistent banner rather than a toast.
export function CalendarReconnectBanner() {
  const { data } = useConnectedCalendarProviders();
  const needsReconnect = data?.needsReconnect ?? [];

  if (needsReconnect.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-destructive-surface-border bg-destructive-surface px-4 py-2.5">
      {needsReconnect.map((provider) => {
        const name = capitalize(provider);
        return (
          <div
            key={provider}
            role="alert"
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <TriangleAlert
                className="h-4 w-4 shrink-0 text-destructive"
                strokeWidth={2.25}
              />
              <p className="text-sm text-destructive truncate">
                <span className="font-medium">{name} Calendar</span> needs
                reconnecting — sync is paused until you sign in again.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 border-destructive-surface-border bg-transparent text-destructive hover:bg-destructive-surface-hover"
              onClick={() => {
                window.location.href = `/api/calendar/connect/${provider}`;
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Reconnect
            </Button>
          </div>
        );
      })}
    </div>
  );
}
