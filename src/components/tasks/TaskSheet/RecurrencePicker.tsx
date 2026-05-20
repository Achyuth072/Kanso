"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import { formatRecurrenceRule } from "@/lib/utils/recurrence";
import { useHaptic } from "@/lib/hooks/useHaptic";

interface RecurrencePickerProps {
  value: RecurrenceRule | null;
  onChange: (value: RecurrenceRule | null) => void;
  variant?: "default" | "icon";
  isMobile?: boolean;
}

const PRESET_RULES: { label: string; value: RecurrenceRule | null }[] = [
  { label: "Does not repeat", value: null },
  { label: "Daily", value: { freq: "DAILY", interval: 1 } },
  { label: "Weekly", value: { freq: "WEEKLY", interval: 1 } },
  { label: "Monthly", value: { freq: "MONTHLY", interval: 1 } },
  { label: "Yearly", value: { freq: "YEARLY", interval: 1 } },
];

// Helper to get the letter code for the badge
function getRecurrenceBadge(value: RecurrenceRule | null) {
  if (!value) return null;

  if (value.interval === 1) {
    switch (value.freq) {
      case "DAILY":
        return "D";
      case "WEEKLY":
        return "W";
      case "MONTHLY":
        return "M";
      case "YEARLY":
        return "Y";
    }
  }
  return "C"; // Custom
}

export default function RecurrencePicker({
  value,
  onChange,
  variant = "default",
  isMobile = false,
}: RecurrencePickerProps) {
  const [open, setOpen] = useState(false);
  const isIconVariant = variant === "icon";
  const hasRecurrence = !!value;
  const badgeLetter = hasRecurrence ? getRecurrenceBadge(value) : null;
  const { trigger } = useHaptic();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isIconVariant ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 w-9 p-0 transition-all group relative border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-none",
              hasRecurrence
                ? "text-brand bg-brand/10 hover:bg-brand/20 hover:text-brand border-transparent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            onClick={() => {
              trigger("toggle");
            }}
            title={!isMobile ? formatRecurrenceRule(value) : undefined}
          >
            <Repeat className="h-4 w-4 transition-all" strokeWidth={2} />
            {hasRecurrence && badgeLetter && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-brand text-brand-foreground rounded-full flex items-center justify-center">
                {badgeLetter}
              </span>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal h-9 text-[13px]"
          >
            <Repeat className="mr-2 h-4 w-4" />
            {formatRecurrenceRule(value)}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {PRESET_RULES.map((preset) => (
            <Button
              key={preset.label}
              variant={
                value?.freq === preset.value?.freq &&
                value?.interval === preset.value?.interval
                  ? "secondary"
                  : "ghost"
              }
              className="w-full justify-start h-8 text-[13px]"
              onClick={() => {
                trigger("toggle");
                // Maintain existing mode if switching between presets
                onChange(
                  preset.value
                    ? { ...preset.value, mode: value?.mode || "flexible" }
                    : null,
                );
                if (!preset.value) setOpen(false);
              }}
            >
              {preset.label}
            </Button>
          ))}

          {value && (
            <div className="pt-2 mt-1 border-t border-border">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Type
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-foreground/[0.04] dark:bg-foreground/[0.06] p-0.5 rounded-md border border-border/40">
                <Button
                  variant={value.mode === "strict" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 text-[11px] px-2 shadow-none rounded-[4px] transition-all",
                    value.mode === "strict"
                      ? "bg-brand text-brand-foreground font-semibold shadow-sm hover:bg-brand hover:text-brand-foreground"
                      : "text-muted-foreground hover:text-muted-foreground hover:bg-transparent",
                  )}
                  onClick={() => {
                    trigger("toggle");
                    onChange({ ...value, mode: "strict" });
                  }}
                >
                  Strict
                </Button>
                <Button
                  variant={
                    !value.mode || value.mode === "flexible"
                      ? "secondary"
                      : "ghost"
                  }
                  size="sm"
                  className={cn(
                    "h-6 text-[11px] px-2 shadow-none rounded-[4px] transition-all",
                    !value.mode || value.mode === "flexible"
                      ? "bg-brand text-brand-foreground font-semibold shadow-sm hover:bg-brand hover:text-brand-foreground"
                      : "text-muted-foreground hover:text-muted-foreground hover:bg-transparent",
                  )}
                  onClick={() => {
                    trigger("toggle");
                    onChange({ ...value, mode: "flexible" });
                  }}
                >
                  Flexible
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-1 leading-tight">
                {value.mode === "strict"
                  ? "Repeats from original due date."
                  : "Repeats from completion date."}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
