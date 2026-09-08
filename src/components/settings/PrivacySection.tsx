"use client";

import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PrivacyPolicyLink } from "@/components/ui/privacy-policy-link";
import { useTelemetryConsent } from "@/lib/hooks/useTelemetryConsent";
import { useHaptic } from "@/lib/hooks/useHaptic";

export function PrivacySection() {
  const { consent, setConsent } = useTelemetryConsent();
  const { trigger } = useHaptic();

  const isEnabled = consent === "granted";

  const handleToggle = (checked: boolean) => {
    trigger("toggle");
    setConsent(checked ? "granted" : "denied");
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-background">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-full bg-secondary/30 shrink-0">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Share Anonymous Telemetry</p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          aria-label="Share Anonymous Telemetry"
          className="shrink-0"
        />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Help improve Kagelin by sharing anonymous usage metrics (feature usage,
        timer durations, platform). Personal data, task titles, and notes are
        never collected or transmitted. See our <PrivacyPolicyLink />.
      </p>
    </div>
  );
}
