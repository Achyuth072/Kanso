"use client";

import { useCallback, useRef } from "react";

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeOptions {
  threshold?: number;
}

/**
 * A hook that detects swipe gestures on mobile devices.
 *
 * @param handlers - Callbacks for different swipe directions
 * @param options - Configuration options like threshold
 * @returns Object with onTouchStart and onTouchEnd handlers to be attached to an element
 */
export function useSwipe(handlers: SwipeHandlers, options: SwipeOptions = {}) {
  const { threshold = 50 } = options;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    const touch =
      "touches" in e ? e.touches[0] : (e as unknown as TouchEvent).touches[0];
    if (!touch) return;

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!touchStart.current) return;

      const touch =
        "changedTouches" in e
          ? e.changedTouches[0]
          : (e as unknown as TouchEvent).changedTouches[0];
      if (!touch) return;

      const xDiff = touchStart.current.x - touch.clientX;
      const yDiff = touchStart.current.y - touch.clientY;

      const absX = Math.abs(xDiff);
      const absY = Math.abs(yDiff);

      if (absX > absY) {
        // Horizontal swipe
        if (absX > threshold) {
          if (xDiff > 0) {
            handlers.onSwipeLeft?.();
          } else {
            handlers.onSwipeRight?.();
          }
        }
      } else {
        // Vertical swipe
        if (absY > threshold) {
          if (yDiff > 0) {
            handlers.onSwipeUp?.();
          } else {
            handlers.onSwipeDown?.();
          }
        }
      }

      touchStart.current = null;
    },
    [handlers, threshold],
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
