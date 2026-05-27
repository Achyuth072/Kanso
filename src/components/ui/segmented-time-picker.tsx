"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";

interface SegmentedTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  className?: string;
  timeFormat?: "12h" | "24h" | "system";
}

export function SegmentedTimePicker({
  value,
  onChange,
  className,
  timeFormat: timeFormatProp,
}: SegmentedTimePickerProps) {
  const { trigger } = useHaptic();
  const { timeFormat: defaultTimeFormat } = useTimeFormat();

  // Resolve effective time format: prop > store default (12h)
  const effectiveFormat = timeFormatProp ?? defaultTimeFormat ?? "12h";

  // For system mode, detect browser locale preference
  const is24hr = useMemo(() => {
    if (effectiveFormat === "system") {
      return new Intl.DateTimeFormat(navigator.language, {
        hour: "numeric",
      })
        .formatToParts(new Date(2024, 0, 1, 14, 0))
        .some((part) => part.value === "14");
    }
    return effectiveFormat === "24h";
  }, [effectiveFormat]);

  const hours = value.getHours();
  const minutes = value.getMinutes();

  const h12 = hours % 12 || 12;
  const isPM = hours >= 12;

  const [activeSegment, setActiveSegment] = useState<"h" | "m" | "p" | null>(
    null,
  );
  const [lastDelta, setLastDelta] = useState<number>(0);
  const [typingBuffer, setTypingBuffer] = useState("");
  const [lastTypedAt, setLastTypedAt] = useState(0);

  const handleFocus = useCallback((segment: "h" | "m" | "p") => {
    setActiveSegment(segment);
    setTypingBuffer("");
    setLastTypedAt(0);
  }, []);

  const updateTime = useCallback(
    (hoursVal: number, min: number, pm?: boolean) => {
      const newDate = new Date(value);
      if (is24hr) {
        // 24hr mode: hoursVal is 0-23
        newDate.setHours(hoursVal);
      } else {
        // 12hr mode: hoursVal is 1-12, pm flag determines AM/PM
        let finalHours = hoursVal;
        if (pm && hoursVal !== 12) finalHours += 12;
        if (!pm && hoursVal === 12) finalHours = 0;
        newDate.setHours(finalHours);
      }
      newDate.setMinutes(min);
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      if (newDate.getTime() !== value.getTime()) {
        onChange(newDate);
      }
    },
    [value, onChange, is24hr],
  );

  const adjustValue = useCallback(
    (segment: "h" | "m" | "p", delta: number) => {
      trigger("tick");
      setLastDelta(delta);
      if (segment === "h") {
        if (is24hr) {
          let nextH = hours + delta;
          if (nextH > 23) nextH = 0;
          if (nextH < 0) nextH = 23;
          updateTime(nextH, minutes);
        } else {
          let nextH = h12 + delta;
          if (nextH > 12) nextH = 1;
          if (nextH < 1) nextH = 12;
          updateTime(nextH, minutes, isPM);
        }
      } else if (segment === "m") {
        let nextM = minutes + delta;
        if (nextM > 59) nextM = 0;
        if (nextM < 0) nextM = 59;
        updateTime(is24hr ? hours : h12, nextM, is24hr ? undefined : isPM);
      } else {
        updateTime(h12, minutes, !isPM);
      }
    },
    [h12, hours, minutes, isPM, is24hr, updateTime, trigger],
  );

  const handleInputChange = (segment: "h" | "m", char: string) => {
    const digit = char.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    const now = Date.now();
    let newBuffer = digit;

    if (now - lastTypedAt < 1500 && typingBuffer.length < 2) {
      newBuffer = typingBuffer + digit;
    }

    setTypingBuffer(newBuffer);
    setLastTypedAt(now);

    const num = parseInt(newBuffer);
    if (isNaN(num)) return;

    if (segment === "h") {
      if (is24hr) {
        let val = num;
        if (val > 23) {
          val = parseInt(digit) || 0;
          setTypingBuffer(digit);
        }
        if (val >= 0 && val <= 23) {
          updateTime(val, minutes);
        }
      } else {
        let val = num;
        if (val > 12) {
          val = parseInt(digit) || 1;
          setTypingBuffer(digit);
        }

        if (val === 0) {
          if (newBuffer.length === 2) {
            val = 12;
            updateTime(val, minutes, isPM);
          }
          return;
        }

        updateTime(val, minutes, isPM);
      }
    } else {
      let val = num;
      if (val > 59) {
        val = parseInt(digit);
        setTypingBuffer(digit);
      }
      updateTime(is24hr ? hours : h12, val, is24hr ? undefined : isPM);
    }
    trigger("tick");
  };

  const handleKeyDown = (e: React.KeyboardEvent, segment: "h" | "m" | "p") => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      adjustValue(segment, 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      adjustValue(segment, -1);
    } else if (e.key === "Enter" || e.key === "Escape") {
      (e.target as HTMLElement).blur();
    } else if (/^[0-9]$/.test(e.key) && (segment === "h" || segment === "m")) {
      e.preventDefault();
      e.stopPropagation();
      handleInputChange(segment, e.key);
    } else if (
      !is24hr &&
      segment === "p" &&
      (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "p")
    ) {
      e.preventDefault();
      e.stopPropagation();
      const shouldBePM = e.key.toLowerCase() === "p";
      if (isPM !== shouldBePM) {
        updateTime(h12, minutes, shouldBePM);
        trigger("toggle");
      }
    }
  };

  const handleWheel = (e: React.WheelEvent, segment: "h" | "m" | "p") => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;
    adjustValue(segment, delta);
  };

  const [dragStart, setDragStart] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDragStart(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent, segment: "h" | "m") => {
    e.stopPropagation();
    if (dragStart === null) return;
    const delta = dragStart - e.clientY;
    if (Math.abs(delta) > 20) {
      adjustValue(segment, delta > 0 ? 1 : -1);
    }
    setDragStart(null);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-2 select-none touch-none",
        className,
      )}
      data-vaul-no-drag
    >
      <div className="flex items-center gap-1.5 md:gap-2 font-light tabular-nums tracking-tighter">
        <div className="flex items-center gap-0.5">
          {/* Hours Segment */}
          <div className="relative group">
            {/* Visible display — pointer-events-none so the input overlay receives all interactions */}
            <div
              className={cn(
                "relative px-3 md:px-4 py-2 rounded-lg transition-all duration-300 border-2 touch-none pointer-events-none select-none",
                activeSegment === "h"
                  ? "text-foreground bg-brand/10 border-brand/40 shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)]"
                  : "text-foreground/80 border-transparent",
              )}
            >
              <motion.span
                key={`h-${is24hr ? hours : h12}`}
                initial={{ y: lastDelta > 0 ? -2 : 2, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="text-4xl md:text-5xl leading-none block font-semibold tracking-tight"
              >
                {(is24hr ? hours : h12).toString().padStart(2, "0")}
              </motion.span>
            </div>
            {/* Transparent input — receives focus and summons Android keyboard via inputMode */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg focus:outline-none"
              aria-label="Adjust Hours"
              data-vaul-no-drag
              onFocus={() => handleFocus("h")}
              onBlur={() => setActiveSegment(null)}
              onKeyDown={(e) => handleKeyDown(e, "h")}
              onWheel={(e) => handleWheel(e, "h")}
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp(e, "h")}
              onChange={(e) => {
                // Catches Android IME input when onKeyDown key is "Unidentified"
                const digit = e.target.value.replace(/\D/g, "").slice(-1);
                if (digit) handleInputChange("h", digit);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <span className="text-2xl md:text-3xl text-foreground/20 font-thin self-center translate-y-[-1px]">
            :
          </span>

          {/* Minutes Segment */}
          <div className="relative group">
            {/* Visible display */}
            <div
              className={cn(
                "relative px-3 md:px-4 py-2 rounded-lg transition-all duration-300 border-2 touch-none pointer-events-none select-none",
                activeSegment === "m"
                  ? "text-foreground bg-brand/10 border-brand/40 shadow-[0_0_15px_rgba(var(--brand-rgb),0.2)]"
                  : "text-foreground/80 border-transparent",
              )}
            >
              <motion.span
                key={`m-${minutes}`}
                initial={{ y: lastDelta > 0 ? -2 : 2, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="text-4xl md:text-5xl leading-none block font-semibold tracking-tight"
              >
                {minutes.toString().padStart(2, "0")}
              </motion.span>
            </div>
            {/* Transparent input */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-lg focus:outline-none"
              aria-label="Adjust Minutes"
              data-vaul-no-drag
              onFocus={() => handleFocus("m")}
              onBlur={() => setActiveSegment(null)}
              onKeyDown={(e) => handleKeyDown(e, "m")}
              onWheel={(e) => handleWheel(e, "m")}
              onPointerDown={handlePointerDown}
              onPointerUp={(e) => handlePointerUp(e, "m")}
              onChange={(e) => {
                const digit = e.target.value.replace(/\D/g, "").slice(-1);
                if (digit) handleInputChange("m", digit);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        {/* AM/PM Toggle - hidden in 24hr mode */}
        {!is24hr && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              trigger("toggle");
              updateTime(h12, minutes, !isPM);
            }}
            onFocus={() => handleFocus("p")}
            onBlur={() => setActiveSegment(null)}
            onKeyDown={(e) => handleKeyDown(e, "p")}
            onWheel={(e) => handleWheel(e, "p")}
            data-vaul-no-drag
            aria-label="Toggle AM PM"
            className={cn(
              "relative w-14 h-9 flex items-center justify-center rounded-md transition-all duration-300 outline-none uppercase font-bold tracking-[0.05em] text-[10px] self-center border touch-none",
              activeSegment === "p"
                ? "text-brand bg-brand/15 border-brand/40 shadow-sm"
                : "text-foreground/80 bg-transparent border-border/20 hover:border-border/50 hover:text-foreground focus-visible:bg-brand/15 focus-visible:border-brand/40",
              isPM && activeSegment !== "p" ? "text-foreground/90" : "",
            )}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={isPM ? "pm" : "am"}
                initial={{ opacity: 0, y: 1 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -1 }}
                transition={{ duration: 0.12 }}
                className="absolute"
              >
                {isPM ? "PM" : "AM"}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
}
