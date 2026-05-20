"use client";

import {
  Bell,
  BellOff,
  Globe,
  Coffee,
  Moon,
  Calendar,
  Clock,
  Timer,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/push-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";

const getInitialTimezones = () => {
  if (typeof window === "undefined")
    return ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];
  try {
    return (
      Intl as unknown as { supportedValuesOf: (key: string) => string[] }
    ).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];
  }
};

export function NotificationSettings() {
  const {
    isSupported,
    permission,
    notificationsEnabled,
    isSyncing,
    requestPermission,
    subscribeToPush,
    unsubscribe,
  } = usePushNotifications();
  const { isGuestMode } = useAuth();
  const { profile, updateProfile, updateSettings } = useProfile();
  const { trigger } = useHaptic();

  const [timezones] = useState<string[]>(getInitialTimezones);
  const [timezoneSearch, setTimezoneSearch] = useState("");

  // Memoize timezone data with offsets once
  const timezoneOptions = useMemo(() => {
    const now = new Date();
    return timezones.map((tz) => {
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "shortOffset",
        });
        const parts = formatter.formatToParts(now);
        const offset =
          parts.find((p) => p.type === "timeZoneName")?.value || "";
        return {
          id: tz,
          label: tz.replace(/_/g, " "),
          offset: offset.replace("GMT", "UTC"),
          searchable: `${tz} ${offset}`.toLowerCase().replace(/[_/]/g, " "),
        };
      } catch {
        return {
          id: tz,
          label: tz.replace(/_/g, " "),
          offset: "",
          searchable: tz.toLowerCase().replace(/[_/]/g, " "),
        };
      }
    });
  }, [timezones]);

  // Filter and limit results, ensuring current selection is ALWAYS present
  const filteredTimezones = useMemo(() => {
    const search = timezoneSearch.toLowerCase().trim();
    const currentTz = profile?.timezone || "UTC";

    const results = search
      ? timezoneOptions.filter((opt) => opt.searchable.includes(search))
      : timezoneOptions;

    // Separate top 100
    const topResults = results.slice(0, 100);

    // If current selection is NOT in top results but IS in the overall matching results, add it
    const isSelectedInTop = topResults.some((opt) => opt.id === currentTz);

    if (!isSelectedInTop) {
      const selectedOpt = results.find((opt) => opt.id === currentTz);
      if (selectedOpt) {
        // Add current selection to the top of the list if searching, or keep batch small
        return [selectedOpt, ...topResults];
      }
    }

    return topResults;
  }, [timezoneOptions, timezoneSearch, profile?.timezone]);

  const handleTogglePush = async (checked: boolean) => {
    if (isSyncing) return;
    trigger("toggle");

    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return;
    }

    if (checked) {
      const result = await requestPermission({ forceRefresh: true });
      if (result.permission === "granted" && result.subscription) {
        toast.success("Notifications enabled");
      } else if (result.permission === "denied") {
        toast.error("Permission denied. Enable in browser settings.");
      } else {
        toast.error("Failed to activate notifications on this device.");
      }
    } else {
      await unsubscribe();
      toast.success("Notifications disabled");
    }
  };

  const updateNotifySetting = async (key: string, checked: boolean) => {
    trigger("tick");
    try {
      await updateSettings.mutateAsync({
        notifications: {
          ...profile?.settings?.notifications,
          [key]: checked,
        },
      } as Parameters<typeof updateSettings.mutateAsync>[0]);
    } catch {
      toast.error("Failed to update settings");
    }
  };

  const handleTestNotification = async () => {
    trigger("toggle");
    if (permission !== "granted") {
      toast.error("Please enable notifications first");
      return;
    }

    try {
      const activeSubscription = await subscribeToPush("granted", {
        forceRefresh: true,
      });

      if (!activeSubscription) {
        toast.error("Failed to refresh notifications on this device");
        return;
      }

      await sendPushNotification({
        endpoint: activeSubscription.endpoint,
        title: "Test Notification",
        body: "This is a server-sent test notification from Kanso",
        data: { type: "test" },
      });
      toast.success("Test notification sent to this device");
    } catch {
      toast.error("Failed to send test notification");
    }
  };

  const handleLocalTestNotification = () => {
    trigger("toggle");
    if (permission !== "granted") {
      toast.error("Please enable notifications first");
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification("Local Test Notification", {
          body: "This notification was triggered locally from the browser.",
          icon: "/icons/icon-192.png",
          tag: "kanso-local-test",
        });
        toast.success("Local notification triggered");
      });
    } else {
      toast.error("Service worker not supported");
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 rounded-lg border border-border/50 bg-muted/30">
        <div className="flex items-center gap-3 mb-2">
          <BellOff className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            Notifications Not Supported
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your browser doesn&apos;t support push notifications
        </p>
      </div>
    );
  }

  const settings = profile?.settings?.notifications;

  return (
    <div className="space-y-6">
      {/* 1. Master Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-secondary/30">
              <Bell className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground">
                {permission === "granted"
                  ? "Receive updates and reminders"
                  : "Enable to receive updates"}
              </p>
            </div>
          </div>
          <Switch
            checked={notificationsEnabled && permission === "granted"}
            onCheckedChange={handleTogglePush}
            disabled={permission === "denied" || isSyncing}
            aria-label="Push Notifications"
          />
        </div>

        {permission === "granted" && notificationsEnabled && !isSyncing && (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleTestNotification}
            >
              <Bell className="h-4 w-4 mr-2" />
              Send Test Notification (Server)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[10px] text-muted-foreground hover:text-foreground h-7"
              onClick={handleLocalTestNotification}
            >
              Trigger Local Notification (Sanity Check)
            </Button>
          </div>
        )}
      </div>

      {/* 2. Timezone Selection */}
      {!isGuestMode && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Local Time
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Confirm your timezone to ensure morning briefings and task alerts
              arrive at the right local time.
            </p>
            <Select
              value={profile?.timezone || "UTC"}
              onValueChange={(val) => {
                trigger("toggle");
                updateProfile.mutate({ timezone: val });
                setTimezoneSearch(""); // Clear search on selection
              }}
            >
              <SelectTrigger className="w-full" aria-label="Select Timezone">
                <SelectValue placeholder="Select Timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] w-[--radix-select-trigger-width]">
                <div className="sticky top-0 z-10 bg-popover px-2 py-2 pt-4 border-b border-border/50">
                  <input
                    type="text"
                    placeholder="Search timezone..."
                    value={timezoneSearch}
                    onChange={(e) => setTimezoneSearch(e.target.value)}
                    onKeyDown={(e) => {
                      // Prevent Radix Select from intercepting key events
                      e.stopPropagation();
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="overflow-y-auto max-h-[240px]">
                  {filteredTimezones.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No timezone found
                    </div>
                  ) : (
                    filteredTimezones.map((tz) => {
                      return (
                        <SelectItem key={tz.id} value={tz.id}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span className="truncate">{tz.label}</span>
                            {tz.offset && (
                              <span className="text-xs text-muted-foreground font-mono shrink-0">
                                {tz.offset}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 3. Detailed Schedules */}
      {permission === "granted" && notificationsEnabled && !isGuestMode && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schedules
            </h3>
          </div>

          <div className="space-y-2">
            {/* Morning Briefing */}
            <ScheduleToggle
              icon={Coffee}
              title="Morning Briefing"
              description="Daily summary at 8:00 AM"
              checked={settings?.morning_briefing ?? true}
              onChange={(c) => updateNotifySetting("morning_briefing", c)}
            />

            {/* Evening Plan */}
            <ScheduleToggle
              icon={Moon}
              title="Evening Plan"
              description="Review tonight's tasks at 6:00 PM"
              checked={settings?.evening_plan ?? true}
              onChange={(c) => updateNotifySetting("evening_plan", c)}
            />

            {/* Smart Alerts */}
            <ScheduleToggle
              icon={Calendar}
              title="Due Date Alerts"
              description="When a task reaches its deadline"
              checked={settings?.due_date_alerts ?? true}
              onChange={(c) => updateNotifySetting("due_date_alerts", c)}
            />

            <ScheduleToggle
              icon={Timer}
              title="Timer Completion"
              description="When your focus or break ends"
              checked={settings?.timer_alerts ?? true}
              onChange={(c) => updateNotifySetting("timer_alerts", c)}
            />
          </div>
        </div>
      )}

      {isGuestMode && permission === "granted" && (
        <p className="text-xs text-center text-muted-foreground px-2">
          Morning briefings and server-side alerts require a synced account.
        </p>
      )}
    </div>
  );
}

function ScheduleToggle({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border border-border/30 bg-muted/20">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
