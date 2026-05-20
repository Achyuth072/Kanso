"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { HabitHeatmap } from "./HabitHeatmap";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useMarkHabitComplete } from "@/lib/hooks/useHabitMutations";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";
import { Check, Plus, LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";

interface HabitCardProps {
  habit: HabitWithEntries;
  icon?: LucideIcon;
  onToggle?: () => void;
  onEdit?: () => void;
}

/**
 * HabitCard Component
 *
 * Displays a habit with its heatmap, stats, and completion toggle.
 * Implements a prioritized heatmap layout:
 * - Stats moved to header for better focus hierarchy.
 * - Auto-scrolls heatmap to most recent data in the background.
 */
export function HabitCard({
  habit,
  icon: Icon,
  onToggle,
  onEdit,
}: HabitCardProps) {
  const isMobile = useIsMobile();
  const markComplete = useMarkHabitComplete();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useHorizontalScroll();
  const hasAutoScrolled = useRef(false);

  // Stable ref setter — only sets the ref once on mount, never triggers detach/reattach
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (
      scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
    ).current = node;
  }, []);

  // Attach/detach horizontal scroll listener only when isMobile changes, not on every render
  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    if (!isMobile) {
      horizontalScrollRef(node);
      return () => horizontalScrollRef(null);
    }
  }, [isMobile, horizontalScrollRef]);

  // Background scroll to end on mount
  useLayoutEffect(() => {
    // Only auto-scroll once on initial mount / data load, not on every re-render
    if (hasAutoScrolled.current) return;

    const frame = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft =
          scrollContainerRef.current.scrollWidth;
        hasAutoScrolled.current = true;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [habit.entries]);

  // Check if today's entry exists
  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntry = habit.entries.find((e) => e.date === today);
  const isCompletedToday = todayEntry?.value === 1;

  // Calculate stats
  const totalCompletions = habit.entries.filter((e) => e.value === 1).length;

  // Calculate current streak
  const calculateStreak = useCallback(() => {
    const sortedEntries = [...habit.entries]
      .filter((e) => e.value === 1)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let streak = 0;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedEntries.length; i++) {
      const entryDate = new Date(sortedEntries[i].date);
      entryDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(todayDate);
      expectedDate.setDate(expectedDate.getDate() - streak);

      if (entryDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, [habit.entries]);

  const currentStreak = calculateStreak();

  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
      return;
    }

    // Default: mark today as complete/incomplete
    markComplete.mutate({
      habitId: habit.id,
      date: today,
      value: isCompletedToday ? 0 : 1,
    });
  }, [onToggle, markComplete, habit.id, today, isCompletedToday]);

  return (
    <Card
      onClick={onEdit}
      className="bg-card border border-border dark:border-border/40 p-6 rounded-xl overflow-hidden shadow-none transition-seijaku-fast hover:border-border/60 hover:shadow-sm cursor-pointer active:scale-[0.995] min-w-0"
    >
      <div className="flex flex-col gap-6">
        {/* Header: Title, Description + Toggle */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4 items-center min-w-0">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground flex items-center gap-2.5 min-w-0">
                {Icon && (
                  <Icon
                    className="w-5 h-5 shrink-0"
                    strokeWidth={2.25}
                    style={{ color: habit.color }}
                  />
                )}
                <span className="truncate">{habit.name}</span>
              </h3>
              {habit.description && (
                <p className="text-[13px] text-foreground/60 mt-1 truncate leading-relaxed font-medium">
                  {habit.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Stats in Header */}
            <div className="flex items-center gap-4 sm:gap-6 mr-1 sm:mr-2">
              <div className="text-right">
                <div className="text-[9px] uppercase text-foreground/60 font-bold tracking-widest leading-none">
                  Streak
                </div>
                <div className="text-sm font-bold text-foreground mt-1">
                  {currentStreak}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase text-foreground/60 font-bold tracking-widest leading-none">
                  Total
                </div>
                <div className="text-sm font-bold text-foreground mt-1">
                  {totalCompletions}
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-seijaku-fast shrink-0 ${
                isCompletedToday
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary border border-border hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
              }`}
              style={
                isCompletedToday ? { backgroundColor: habit.color } : undefined
              }
              aria-label={
                isCompletedToday ? "Mark incomplete" : "Mark complete"
              }
            >
              {isCompletedToday ? (
                <Check className="w-5 h-5 text-black" strokeWidth={3} />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Heatmap Area - Large Visual Centerpiece */}
        <div
          ref={setScrollRef}
          className="w-full overflow-x-auto pb-1 scrollbar-hide min-w-0"
        >
          <HabitHeatmap
            entries={habit.entries}
            color={habit.color}
            blockSize={isMobile ? 10 : 12}
            blockMargin={2}
            startDate={habit.start_date}
          />
        </div>
      </div>
    </Card>
  );
}
