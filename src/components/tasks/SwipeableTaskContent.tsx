import React from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableTaskContentProps {
  children: React.ReactNode;
  isDesktop: boolean;
  _isDragging: boolean;
  _viewMode: "list" | "grid" | "board";
  _isHandleActive: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  className?: string;
  onClick?: () => void;
  suspended?: boolean;
  isCompleted?: boolean;
}

const SWIPE_THRESHOLD = 150;
const SCHEDULE_SWIPE_THRESHOLD = 150;

export function SwipeableTaskContent({
  children,
  _isDragging,
  _viewMode,
  _isHandleActive,
  onSwipeLeft,
  onSwipeRight,
  onSwipeStart,
  onSwipeEnd,
  className,
  onClick,
  suspended = false,
  isCompleted = false,
}: SwipeableTaskContentProps) {
  const x = useMotionValue(0);

  const completeBgOpacity = useTransform(x, [0, 5, 25, 30], [0, 0.1, 1, 1]);
  const deleteBgOpacity = useTransform(x, [-30, -25, -5, 0], [1, 1, 0.1, 0]);

  const leftIconOpacity = useTransform(x, [5, 20], [0, 1]);
  const rightIconOpacity = useTransform(x, [-20, -5], [1, 0]);
  const leftIconScale = useTransform(x, [0, 25], [0.8, 1]);
  const rightIconScale = useTransform(x, [-25, 0], [1, 0.8]);

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    onSwipeEnd?.();
    if (isCompleted) return;
    if (info.offset.x < -SWIPE_THRESHOLD) {
      (document.activeElement as HTMLElement)?.blur();
      onSwipeLeft();
    } else if (info.offset.x > SCHEDULE_SWIPE_THRESHOLD) {
      (document.activeElement as HTMLElement)?.blur();
      onSwipeRight();
    }
  };

  if (suspended) {
    return (
      <div className={cn("relative", className)} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Swipe backgrounds (Siblings) */}
      <motion.div
        className="absolute inset-0 bg-brand flex items-center pl-4"
        style={{ opacity: completeBgOpacity }}
      >
        <motion.div
          style={{ opacity: leftIconOpacity, scale: leftIconScale }}
          className="text-white pointer-events-none"
        >
          <Pencil className="h-5 w-5" strokeWidth={2.25} />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-4"
        style={{ opacity: deleteBgOpacity }}
      >
        <motion.div
          style={{ opacity: rightIconOpacity, scale: rightIconScale }}
          className="text-white pointer-events-none"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2.25} />
        </motion.div>
      </motion.div>

      {/* Main content */}
      <motion.div
        key={`content-${isCompleted}`}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{
          left: isCompleted ? 0 : 0.2,
          right: isCompleted ? 0 : 0.2,
        }}
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={onSwipeStart}
        onDragEnd={handleDragEnd}
        className={cn("relative z-10 bg-background", className)}
        onClick={onClick}
      >
        {children}
      </motion.div>
    </div>
  );
}
