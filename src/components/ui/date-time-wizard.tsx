"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { Calendar } from "@/components/ui/calendar";
import { SegmentedTimePicker } from "@/components/ui/segmented-time-picker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimeWizardProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  onClose: () => void;
  showTime?: boolean;
  allowPastDates?: boolean;
}

export function DateTimeWizard({
  date,
  setDate,
  onClose,
  showTime = true,
  allowPastDates = false,
}: DateTimeWizardProps) {
  const { trigger } = useHaptic();
  const { formatTime } = useTimeFormat();
  const [step, setStep] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState<Date | undefined>(date);

  // Sync tempDate if prop changes externally (optional, but good practice)
  useEffect(() => {
    setTempDate(date);
  }, [date]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setTempDate(undefined);
      return;
    }

    // Preserve time if already set, or set default time (12:00 PM / Noon)
    const updatedDate = new Date(newDate);
    if (tempDate) {
      // Date already exists, keep its time
      updatedDate.setHours(tempDate.getHours(), tempDate.getMinutes());
    } else {
      // New date, default to 12:00 PM (noon) instead of 9 AM
      updatedDate.setHours(12, 0, 0, 0);
    }

    setTempDate(updatedDate);
  };

  const handleTimeChange = (newTime: Date) => {
    // SegmentedTimePicker returns a Date object with correct time parts
    setTempDate(newTime);
  };

  const onSave = () => {
    trigger("thud");
    setDate(tempDate);
    onClose();
  };

  return (
    <div className="flex flex-col w-full max-w-[320px] mx-auto bg-popover rounded-md overflow-hidden">
      {/* Header / Tabs */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/40">
        <Tabs
          value={step}
          onValueChange={(v) => {
            trigger("toggle");
            setStep(v as "date" | "time");
          }}
          className="w-full"
        >
          <TabsList
            className={cn(
              "grid w-full h-9 p-0.5 bg-muted/50",
              showTime ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <TabsTrigger
              value="date"
              className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-sm"
            >
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              {tempDate ? format(tempDate, "MMM d") : "Date"}
            </TabsTrigger>
            {showTime && (
              <TabsTrigger
                value="time"
                disabled={!tempDate}
                className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                {tempDate ? formatTime(tempDate) : "Time"}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="p-2 sm:p-3">
        {step === "date" ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <Calendar
              mode="single"
              selected={tempDate}
              onSelect={handleDateSelect}
              disabled={
                allowPastDates
                  ? undefined
                  : { before: new Date(new Date().setHours(0, 0, 0, 0)) }
              }
              captionLayout="dropdown"
              fromYear={new Date().getFullYear() - 1}
              toYear={new Date().getFullYear() + 5}
              initialFocus
              className="rounded-md border-0 w-full flex justify-center p-3"
              classNames={{
                month: "space-y-4 w-full",
                table: "w-full border-collapse space-y-1",
                head_row: "flex w-full justify-between",
                row: "flex w-full justify-between mt-2",

                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground",
                head_cell:
                  "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",
              }}
            />
            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2 mt-3 p-1 bg-muted/20 rounded-md border border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] sm:text-xs font-semibold hover:bg-background hover:shadow-sm"
                onClick={() => {
                  trigger("tick");
                  const today = new Date();
                  today.setHours(12, 0, 0, 0); // Default Noon
                  handleDateSelect(today);
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] sm:text-xs font-semibold hover:bg-background hover:shadow-sm"
                onClick={() => {
                  trigger("tick");
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(12, 0, 0, 0); // Default Noon
                  handleDateSelect(tomorrow);
                }}
              >
                Tomorrow
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] sm:text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-700 dark:hover:text-purple-300"
                onClick={() => {
                  trigger("tick");
                  const evening = new Date();
                  evening.setHours(18, 0, 0, 0); // 6 PM
                  setTempDate(evening);
                }}
              >
                Evening
              </Button>
            </div>

            {/* Date View Footer */}
            <div className="mt-2 w-full flex justify-end">
              <Button size="sm" className="gap-1.5 w-full" onClick={onSave}>
                <Check className="w-3.5 h-3.5" />
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in slide-in-from-right-5 fade-in duration-200">
            <div className="text-sm font-medium text-muted-foreground mb-4">
              Set Time for {tempDate ? format(tempDate, "MMMM d") : "Today"}
            </div>

            <SegmentedTimePicker
              value={tempDate || new Date()}
              onChange={handleTimeChange}
            />

            <div className="mt-4 w-full flex justify-end">
              <Button size="sm" className="gap-1.5 w-full" onClick={onSave}>
                <Check className="w-3.5 h-3.5" />
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
