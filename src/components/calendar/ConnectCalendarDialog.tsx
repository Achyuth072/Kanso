"use client";

// CalDAV connect was removed pre-beta; legacy-credential purge lives in `src/lib/storage-cleanup.ts`.

import React, { useState, useCallback } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { DialogTrigger } from "@/components/ui/dialog";
import { DrawerTrigger } from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import {
  CalendarSync,
  CheckCircle2,
  Trash2,
  Loader2,
  Calendars,
  ArrowLeft,
} from "lucide-react";
import {
  CalendarProvider,
  CALDAV_PROVIDERS,
  DiscoveredCalendar,
} from "@/lib/types/external-calendar";
import { cn, capitalize } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useConnectedCalendarProviders,
  useDisconnectCalendarProvider,
} from "@/lib/hooks/useConnectedCalendarProviders";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { connectCalendars } from "@/lib/mutations/external-calendar";

interface ConnectCalendarDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConnectCalendarDialog({
  onSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ConnectCalendarDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = useCallback(
    (val: boolean) => {
      if (isControlled) onOpenChange?.(val);
      else setUncontrolledOpen(val);
    },
    [isControlled, onOpenChange],
  );
  const [step, setStep] = useState<"select" | "pick_calendars">("select");
  const { data: connectedState } = useConnectedCalendarProviders();
  const connectedProviders = connectedState?.providers ?? [];
  const disconnect = useDisconnectCalendarProvider();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] =
    useState<CalendarProvider | null>(null);

  const [pickerCalendars, setPickerCalendars] = useState<DiscoveredCalendar[]>(
    [],
  );
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const openCalendarPicker = useCallback(async (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    setStep("pick_calendars");
    setPickerLoading(true);
    setPickerError(null);
    setPickerCalendars([]);
    try {
      const [discoverRes, configuredRes] = await Promise.all([
        fetch(`/api/calendar/discover?provider=${provider}`),
        fetch(`/api/calendar/calendars`),
      ]);
      if (!discoverRes.ok) {
        const { error } = await discoverRes.json().catch(() => ({ error: "" }));
        throw new Error(error || "Failed to list calendars");
      }
      const { calendars } = await discoverRes.json();
      const { calendars: configured = [] } = configuredRes.ok
        ? await configuredRes.json()
        : { calendars: [] };
      const alreadyAdded = new Set(
        configured
          .filter((c: { provider: string }) => c.provider === provider)
          .map((c: { remote_calendar_id: string }) => c.remote_calendar_id),
      );
      setPickerCalendars(calendars);
      setPickerSelected(alreadyAdded as Set<string>);
    } catch (e) {
      setPickerError(
        e instanceof Error ? e.message : "Failed to list calendars",
      );
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const togglePick = (id: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveCalendarPicks = async () => {
    if (!selectedProvider) return;
    setPickerSaving(true);
    try {
      await connectCalendars(
        selectedProvider,
        pickerCalendars.filter((c) => pickerSelected.has(c.url)),
      );
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      notify.success("Calendars saved — run Sync to pull events");
      setOpen(false);
      onSuccess?.();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to save calendars");
    } finally {
      setPickerSaving(false);
    }
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (!connected || CALDAV_PROVIDERS.includes(connected as CalendarProvider))
      return;

    notify.success(`${capitalize(connected)} Calendar connected`);
    queryClient.invalidateQueries({
      queryKey: ["calendar-connected-providers"],
    });
    window.history.replaceState({}, "", "/calendar");
    setOpen(true);
    openCalendarPicker(connected as CalendarProvider);
  }, [openCalendarPicker, queryClient, setOpen]);

  const resetDialog = () => {
    setStep("select");
    setSelectedProvider(null);
    setPickerCalendars([]);
    setPickerSelected(new Set());
    setPickerError(null);
  };

  const handleProviderSelect = (provider: CalendarProvider) => {
    window.location.href = `/api/calendar/connect/${provider}`;
  };

  const isMobile = useMediaQuery("(max-width: 640px)");
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetDialog();
      }}
    >
      {trigger ? (
        <Trigger asChild>{trigger}</Trigger>
      ) : !isControlled ? (
        <Trigger asChild>
          <Button
            variant="outline"
            className={cn("gap-2", "w-10 px-0 md:w-auto md:px-4")}
          >
            <CalendarSync className="w-4 h-4" />
            <span className="hidden md:inline">Connect Calendar</span>
          </Button>
        </Trigger>
      ) : null}

      <ResponsiveDialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-t-[20px] sm:rounded-xl">
        <ResponsiveDialogHeader className="px-4 pt-6 sm:px-6 text-left">
          <ResponsiveDialogTitle className="text-xl font-semibold tracking-tight capitalize">
            {step === "select" && "Connect Calendar"}
            {step === "pick_calendars" && `${selectedProvider} Calendars`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm text-muted-foreground/80">
            {step === "select" && "Sync your events from external providers."}
            {step === "pick_calendars" &&
              "Choose which calendars to sync with Kagelin."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {step === "select" && connectedProviders.length > 0 && (
          <div className="px-4 pt-4 sm:px-6 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connected
            </p>
            {connectedProviders.map((p) => (
              <div
                key={p}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className="w-4 h-4 text-green-500"
                    strokeWidth={2.25}
                  />
                  <span className="text-sm font-medium capitalize">{p}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title={`Choose ${p} calendars`}
                    onClick={() => openCalendarPicker(p as CalendarProvider)}
                  >
                    <Calendars className="w-3.5 h-3.5" strokeWidth={2.25} />
                    Calendars
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive-surface-hover"
                    title={`Disconnect ${p}`}
                    aria-label={`Disconnect ${p}`}
                    onClick={async () => {
                      await disconnect(p);
                      notify.success(`${capitalize(p)} disconnected`);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === "select" && (
          <div className="grid grid-cols-2 gap-4 px-4 py-6 sm:px-6">
            <ProviderButton
              name="Google"
              icon={
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              }
              onClick={() => handleProviderSelect("google")}
            />
            <ProviderButton
              name="Outlook"
              icon={
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path
                    d="M11.4 12L0 12V0l11.4 0v12zM0 24l11.4 0V12.6L0 12.6V24zM12.6 0v11.4L24 11.4V0H12.6zM12.6 24H24V12.6l-11.4 0V24z"
                    fill="#0078D4"
                  />
                </svg>
              }
              onClick={() => handleProviderSelect("outlook")}
            />
          </div>
        )}

        {step === "pick_calendars" && (
          <div className="px-4 py-6 sm:px-6 space-y-4">
            {pickerLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading calendars…
              </div>
            ) : pickerError ? (
              <p className="text-sm text-destructive py-4">{pickerError}</p>
            ) : pickerCalendars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No calendars found for this account.
              </p>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {pickerCalendars.map((cal) => (
                  <label
                    key={cal.url}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 cursor-pointer hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={pickerSelected.has(cal.url)}
                      onCheckedChange={() => togglePick(cal.url)}
                    />
                    {cal.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {cal.displayName}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setStep("select")}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
              </Button>
              <Button
                type="button"
                disabled={
                  pickerSaving || pickerLoading || pickerSelected.size === 0
                }
                onClick={saveCalendarPicks}
                className="bg-brand text-white shadow-brand/10 hover:bg-brand/90"
              >
                {pickerSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  `Save ${pickerSelected.size || ""} calendar${pickerSelected.size === 1 ? "" : "s"}`.trim()
                )}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ProviderButton({
  name,
  subtitle,
  icon,
  onClick,
}: {
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-6 rounded-2xl border bg-card/50",
        "transition-all duration-300 ease-out",
        "hover:border-border/80 hover:bg-accent/30 hover:shadow-sm",
        "active:scale-[0.98] group relative",
      )}
    >
      <div className="mb-3 transition-transform duration-300 group-hover:scale-110">
        {React.cloneElement(
          icon as React.ReactElement<{ className?: string }>,
          {
            className: "w-8 h-8",
          },
        )}
      </div>
      <span className="text-sm font-semibold tracking-tight">{name}</span>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground mt-0.5">
          {subtitle}
        </span>
      )}
    </button>
  );
}
