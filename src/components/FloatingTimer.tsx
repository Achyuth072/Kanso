"use client";

import React, { memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, X, Maximize2 } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUiStore } from "@/lib/store/uiStore";
import { useTimerStore } from "@/lib/store/timerStore";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export const FloatingTimer = memo(function FloatingTimer() {
  const mode = useTimerStore((s) => s.state.mode);
  const isRunning = useTimerStore((s) => s.state.isRunning);
  const remainingSeconds = useTimerStore((s) => s.state.remainingSeconds);
  const completedSessions = useTimerStore((s) => s.state.completedSessions);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);

  const pathname = usePathname();
  const router = useRouter();
  const { trigger, isPhone } = useHaptic();

  const isPipActive = useUiStore((state) => state.isPipActive);

  // Only show if timer is active, NOT on focus page, NOT on mobile, AND NOT in PIP
  const shouldShow =
    (isRunning || completedSessions > 0) &&
    pathname !== "/focus" &&
    !isPhone &&
    !isPipActive;

  const handlePlayPause = () => {
    trigger("toggle");
    if (isRunning) {
      pause();
    } else {
      start();
    }
  };

  const handleMaximize = () => {
    trigger("tick");
    router.push("/focus");
  };

  const handleClose = () => {
    trigger("thud");
    pause();
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 280, damping: 60 }}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 bg-card border border-border rounded-2xl shadow-2xl p-4 min-w-[200px] select-none"
          style={{ touchAction: "none" }}
        >
          {/* Mode Badge */}
          <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">
            {mode === "focus"
              ? "Focus"
              : mode === "shortBreak"
                ? "Short Break"
                : "Long Break"}
          </div>

          {/* Timer Display */}
          <div className="text-3xl font-light font-mono tracking-tight text-foreground tabular-nums text-center mb-3">
            {formatTime(remainingSeconds)}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handlePlayPause}
              aria-label={isRunning ? "Pause timer" : "Start timer"}
              className="h-10 w-10 rounded-full bg-brand text-brand-foreground flex items-center justify-center hover:shadow-brand/20 active:scale-95 transition-all shadow-md"
            >
              {isRunning ? (
                <Pause className="h-4 w-4 fill-current" strokeWidth={2.25} />
              ) : (
                <Play
                  className="h-4 w-4 ml-0.5 fill-current"
                  strokeWidth={2.25}
                />
              )}
            </button>

            <button
              onClick={handleMaximize}
              aria-label="Maximize timer"
              className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleClose}
              aria-label="Close timer"
              className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Session Counter */}
          <div className="text-[10px] text-muted-foreground mt-2 text-center">
            {mode === "focus"
              ? `Session ${completedSessions + 1}`
              : mode === "longBreak"
                ? "Cycle Complete"
                : `Break after Session ${completedSessions}`}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
