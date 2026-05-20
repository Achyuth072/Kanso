"use client";

/**
 * Connect Calendar Dialog
 * Supports: CalDAV, Google (Premium), Outlook (Premium)
 * Per D-48-08: Shows premium badges and gating logic
 */

import React, { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarSync, Shield, Crown, Network, Calendar } from "lucide-react";
import {
  CalendarProvider,
  CALDAV_PROVIDERS,
  isPremiumProvider,
} from "@/lib/types/external-calendar";
import { cn } from "@/lib/utils";
import { discoverCalendars } from "@/lib/caldav/client";
import { Trash2 } from "lucide-react";

const CALDAV_STORAGE_KEY = "kanso_caldav_credentials";

interface ConnectCalendarDialogProps {
  onSuccess?: () => void;
  isPremiumUser?: boolean;
  trigger?: React.ReactNode;
}

export function ConnectCalendarDialog({
  onSuccess,
  isPremiumUser = false,
  trigger,
}: ConnectCalendarDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<
    "select" | "configure_caldav" | "premium_gate" | "coming_soon"
  >("select");
  const [selectedProvider, setSelectedProvider] =
    useState<CalendarProvider | null>(null);

  // CalDAV Configuration Form
  const [caldavForm, setCaldavForm] = useState({
    server_url: "",
    username: "",
    password: "",
    name: "My Calendar",
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredCount, setDiscoveredCount] = useState<number | null>(null);

  // Load stored credentials when the dialog opens
  React.useEffect(() => {
    if (open && typeof window !== "undefined") {
      const stored = localStorage.getItem(CALDAV_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCaldavForm((f) => ({
            ...f,
            server_url: parsed.server_url || "",
            username: parsed.username || "",
            password: parsed.password || "",
          }));
        } catch {
          console.error("Failed to parse stored CalDAV credentials");
        }
      }
    }
  }, [open]);

  const clearStoredCredentials = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CALDAV_STORAGE_KEY);
      setCaldavForm({
        server_url: "",
        username: "",
        password: "",
        name: "My Calendar",
      });
      setError(null);
      setDiscoveredCount(null);
    }
  };

  const resetDialog = () => {
    setStep("select");
    setSelectedProvider(null);
    setError(null);
    setDiscoveredCount(null);
    setCaldavForm({
      server_url: "",
      username: "",
      password: "",
      name: "My Calendar",
    });
  };

  const handleProviderSelect = (provider: CalendarProvider) => {
    setSelectedProvider(provider);
    if (isPremiumProvider(provider) && !isPremiumUser) {
      setStep("premium_gate");
    } else if (CALDAV_PROVIDERS.includes(provider)) {
      setStep("configure_caldav");
      // Set default server URL for known providers
      if (provider === "icloud")
        setCaldavForm((f) => ({
          ...f,
          server_url: "https://caldav.icloud.com",
        }));
      if (provider === "fastmail")
        setCaldavForm((f) => ({
          ...f,
          server_url: "https://caldav.fastmail.com",
        }));
    } else {
      // Handle Google/Outlook OAuth (Premium)
      handleOAuthConnect(provider);
    }
  };

  const handleOAuthConnect = async (provider: CalendarProvider) => {
    // This is a scaffold for Phase 48
    console.log(`Connecting to ${provider} via OAuth (Coming Soon)...`);
    setSelectedProvider(provider);
    setStep("coming_soon");
  };

  const handleCaldavConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);
    setDiscoveredCount(null);

    try {
      const calendars = await discoverCalendars({
        serverUrl: caldavForm.server_url,
        username: caldavForm.username,
        password: caldavForm.password,
      });

      // Save credentials locally upon successful connection
      if (typeof window !== "undefined") {
        localStorage.setItem(CALDAV_STORAGE_KEY, JSON.stringify(caldavForm));
      }

      setDiscoveredCount(calendars.length);
      // Give the user 1.5s to read the success state then close
      setTimeout(() => {
        setOpen(false);
        onSuccess?.();
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to CalDAV server",
      );
    } finally {
      setIsConnecting(false);
    }
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
      <Trigger asChild>
        {trigger || (
          <Button
            variant="outline"
            className={cn("gap-2", "w-10 px-0 md:w-auto md:px-4")}
          >
            <CalendarSync className="w-4 h-4" />
            <span className="hidden md:inline">Connect Calendar</span>
          </Button>
        )}
      </Trigger>

      <ResponsiveDialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-t-[20px] sm:rounded-xl">
        <ResponsiveDialogHeader className="px-4 pt-6 sm:px-6 text-left">
          <ResponsiveDialogTitle className="text-xl font-semibold tracking-tight">
            {step === "select" && "Connect Calendar"}
            {step === "configure_caldav" && `Configure ${selectedProvider}`}
            {step === "premium_gate" && "Upgrade to Premium"}
            {step === "coming_soon" && `${selectedProvider} Support`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-sm text-muted-foreground/80">
            {step === "select" && "Sync your events from external providers."}
            {step === "configure_caldav" &&
              "Enter your server details and app-specific password."}
            {step === "premium_gate" &&
              `Native ${selectedProvider} support requires a premium subscription.`}
            {step === "coming_soon" &&
              `Direct ${selectedProvider} integration is launching soon.`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

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
              isPremium
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
              isPremium
              onClick={() => handleProviderSelect("outlook")}
            />
            <ProviderButton
              name="iCloud"
              icon={
                <svg
                  viewBox="0 0 17 20"
                  className="w-full h-full fill-current text-[#000] dark:text-white"
                >
                  <path d="M15.035 15.353c-.767 1.118-1.586 2.227-2.73 2.247-1.127.02-1.492-.663-2.783-.663-1.29 0-1.693.642-2.762.682-1.11.04-2.016-1.198-2.788-2.316-1.58-2.288-2.787-6.452-1.154-9.284.811-1.406 2.254-2.296 3.824-2.319 1.192-.018 2.316.804 3.045.804.722 0 2.071-.986 3.493-.843 1.455.059 2.115.545 2.62 1.284-3.134 1.84-2.636 5.922.563 7.25-.632 1.564-1.42 3.123-2.328 4.158zm-3.109-12.898c.636-.77 1.05-1.847.933-2.455-.514.022-1.137.345-1.505.77-.33.38-.633.882-.556 1.428.57.043 1.128-.312 1.128-.312z"></path>
                </svg>
              }
              onClick={() => handleProviderSelect("icloud")}
            />
            <ProviderButton
              name="CalDAV"
              subtitle="Nextcloud, etc."
              icon={<Network className="text-muted-foreground" />}
              onClick={() => handleProviderSelect("caldav")}
            />
          </div>
        )}

        {step === "configure_caldav" && (
          <form
            onSubmit={handleCaldavConnect}
            className="space-y-4 px-4 py-6 sm:px-6"
          >
            <div className="space-y-2">
              <Label htmlFor="server_url">Server URL</Label>
              <Input
                id="server_url"
                placeholder="https://caldav.example.com"
                value={caldavForm.server_url}
                onChange={(e) =>
                  setCaldavForm((f) => ({ ...f, server_url: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <Input
                  id="username"
                  placeholder="user@example.com"
                  value={caldavForm.username}
                  onChange={(e) =>
                    setCaldavForm((f) => ({ ...f, username: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">App Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={caldavForm.password}
                  onChange={(e) =>
                    setCaldavForm((f) => ({ ...f, password: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Calendar Name (Local)</Label>
              <Input
                id="name"
                value={caldavForm.name}
                onChange={(e) =>
                  setCaldavForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {discoveredCount !== null && (
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Connected —{" "}
                {discoveredCount === 0
                  ? "no calendars found yet (server is reachable)"
                  : `${discoveredCount} calendar${discoveredCount === 1 ? "" : "s"} discovered`}
              </p>
            )}

            <div className="flex justify-between items-center pt-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="hover:bg-accent/50"
                  onClick={() => setStep("select")}
                >
                  Back
                </Button>
                {(caldavForm.server_url || caldavForm.username) && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-9 w-9"
                    onClick={clearStoredCredentials}
                    title="Forget stored credentials"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                disabled={isConnecting || discoveredCount !== null}
                className="bg-brand text-white shadow-brand/10 hover:bg-brand/90"
              >
                {isConnecting
                  ? "Connecting..."
                  : discoveredCount !== null
                    ? "Connected ✓"
                    : "Connect Calendar"}
              </Button>
            </div>
          </form>
        )}

        {step === "premium_gate" && (
          <div className="px-4 py-8 sm:px-6 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Premium Feature</h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Direct {selectedProvider} sync and bidirectional real-time
                updates are exclusive to Premium users.
              </p>
            </div>
            <div className="w-full space-y-2 pt-6">
              <Button className="w-full bg-brand text-white shadow-sm shadow-brand/10 hover:bg-brand/90 h-11">
                Upgrade to Premium
              </Button>
              <Button
                variant="ghost"
                className="w-full hover:bg-accent/50"
                onClick={() => setStep("select")}
              >
                View Free Alternatives
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2">
              <Shield className="w-3 h-3" />
              <span>Encrypted & Privacy-First Sync</span>
            </div>
          </div>
        )}

        {step === "coming_soon" && (
          <div className="px-4 py-8 sm:px-6 flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-brand" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Native Support Coming Soon
              </h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                We&apos;re currently perfecting the native {selectedProvider}
                sync to ensure your data stays private and encrypted.
              </p>
            </div>
            <div className="w-full space-y-2 pt-6">
              <p className="text-xs text-muted-foreground mb-4">
                In the meantime, you can import your {selectedProvider} calendar
                via **ICS File** or use **CalDAV** if available.
              </p>
              <Button
                variant="outline"
                className="w-full hover:bg-accent/50 h-11"
                onClick={() => setStep("select")}
              >
                Back to Providers
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
  isPremium,
  onClick,
}: {
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  isPremium?: boolean;
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
        isPremium && "opacity-90 hover:opacity-100",
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

      {isPremium && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand/10 text-brand text-[8px] font-bold uppercase tracking-wider shadow-none">
          <Crown className="w-2.5 h-2.5" />
          PRO
        </div>
      )}
    </button>
  );
}
