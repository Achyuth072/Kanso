"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTimer } from "@/components/TimerProvider";
import { buttonVariants, Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Square, SkipForward, X } from "lucide-react";
import { FocusSettingsDialog } from "@/components/FocusSettingsDialog";
import type { TimerMode } from "@/lib/types/timer";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/types/task";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { usePiP } from "@/components/providers/PiPProvider";
import { Minimize2, Target } from "lucide-react";
import { useFocusHistoryStore } from "@/lib/store/focusHistoryStore";
import { useMemo } from "react";

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export default function FocusPage() {
  const router = useRouter();
  const { state, settings, start, pause, stop, skip } = useTimer();
  const supabase = createClient();
  const { trigger, isPhone } = useHaptic();
  const { isPiPSupported, isPiPActive, openPiP, closePiP } = usePiP();
  const { sessions } = useFocusHistoryStore();
  const todaySessionsCount = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.filter(
      (s) => new Date(s.completedAt).toDateString() === today,
    ).length;
  }, [sessions]);

  // Fetch active task if one is set
  const { data: activeTask } = useQuery({
    queryKey: ["task", state.activeTaskId],
    queryFn: async () => {
      if (!state.activeTaskId) return null;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", state.activeTaskId)
        .single();
      return data as Task | null;
    },
    enabled: !!state.activeTaskId,
  });

  const totalSeconds =
    state.mode === "focus"
      ? settings.focusDuration * 60
      : state.mode === "shortBreak"
        ? settings.shortBreakDuration * 60
        : settings.longBreakDuration * 60;

  const progress =
    ((totalSeconds - state.remainingSeconds) / totalSeconds) * 100;

  const handlePlayPause = () => {
    if (state.isRunning) {
      pause();
    } else {
      start();
    }
  };

  const handlePiP = async () => {
    trigger("toggle");
    if (isPiPActive) {
      closePiP();
    } else {
      await openPiP(320, 280);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative select-none cursor-default"
    >
      {/* Close Button */}
      <motion.button
        onClick={() => router.back()}
        onTapStart={() => trigger("thud")}
        whileTap={isPhone ? { scale: 0.95 } : {}}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "absolute top-4 left-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
        )}
      >
        <X className="h-6 w-6" strokeWidth={2.25} />
      </motion.button>

      {/* PiP Button - Only show if supported and NOT on phone */}
      {isPiPSupported && !isPhone && (
        <motion.button
          onClick={handlePiP}
          onTapStart={() => trigger("thud")}
          whileTap={isPhone ? { scale: 0.95 } : {}}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute top-4 right-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
          )}
          title={
            isPiPActive ? "Close Picture-in-Picture" : "Open Picture-in-Picture"
          }
        >
          <Minimize2 className="h-6 w-6" strokeWidth={2.25} />
        </motion.button>
      )}

      {/* Main Timer UI - Hidden when in PiP */}
      <AnimatePresence mode="wait">
        {!isPiPActive ? (
          <motion.div
            key="timer-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center text-center"
          >
            {/* Mode Badge */}
            <div className="type-ui font-medium uppercase tracking-widest text-muted-foreground/80">
              {MODE_LABELS[state.mode]}
            </div>

            {/* Active Task Name */}
            {activeTask && (
              <div className="type-body font-medium text-foreground mt-4 max-w-sm">
                {activeTask.content}
              </div>
            )}

            {/* Timer Display */}
            <div className="text-7xl sm:text-8xl md:text-[10rem] font-extralight font-mono tracking-tighter text-foreground tabular-nums mt-6 leading-none">
              {formatTime(state.remainingSeconds)}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-[240px] mt-12 mb-6">
              <Progress value={progress} className="h-0.5 opacity-40" />
            </div>

            {/* Session Counter & Daily Total */}
            <div className="flex flex-col items-center gap-2 mb-10">
              <p className="type-ui text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {state.mode === "focus"
                  ? `Session ${state.completedSessions + 1} of ${
                      settings.sessionsBeforeLongBreak
                    }`
                  : state.mode === "longBreak"
                    ? "Cycle Complete"
                    : `Break after Session ${state.completedSessions}`}
              </p>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/30 border border-secondary/50">
                <Target className="h-3 w-3 text-primary" strokeWidth={2.25} />
                <span className="type-ui text-[10px] font-semibold text-primary/90">
                  {todaySessionsCount} TODAY
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Stop */}
              <motion.button
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "h-14 w-14 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent/50 transition-seijaku cursor-pointer",
                )}
                onTapStart={() => trigger("thud")}
                whileTap={isPhone ? { scale: 0.95 } : {}}
                onClick={() => {
                  stop();
                  if (isPiPActive) closePiP();
                }}
              >
                <Square className="h-5 w-5" strokeWidth={2.25} />
              </motion.button>

              {/* Play/Pause - Main action button */}
              <motion.button
                className={cn(
                  buttonVariants({ variant: "default", size: "icon" }),
                  "h-20 w-20 rounded-full transition-seijaku hover:scale-105 active:scale-95 active:opacity-90 cursor-pointer",
                )}
                onTapStart={() => trigger("thud")}
                whileTap={isPhone ? { scale: 0.95 } : {}}
                onClick={handlePlayPause}
              >
                {state.isRunning ? (
                  <Pause className="h-8 w-8" strokeWidth={2.25} />
                ) : (
                  <Play className="h-8 w-8 ml-0.5" strokeWidth={2.25} />
                )}
              </motion.button>

              {/* Skip */}
              <motion.button
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "h-14 w-14 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:scale-95 active:bg-accent/50 transition-seijaku cursor-pointer",
                )}
                onTapStart={() => trigger("thud")}
                whileTap={isPhone ? { scale: 0.95 } : {}}
                onClick={skip}
              >
                <SkipForward className="h-5 w-5" strokeWidth={2.25} />
              </motion.button>
            </div>

            {/* Settings Dialog */}
            <div className="mt-16">
              <FocusSettingsDialog />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pip-active-indicator"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center text-center py-12"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Minimize2 className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Viewing in PiP
            </h2>
            <p className="text-muted-foreground max-w-[280px]">
              The timer is running in a floating window. You can browse other
              pages in Kanso.
            </p>
            <Button
              variant="outline"
              className="mt-8 rounded-full px-6"
              onClick={closePiP}
            >
              Return to main view
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
