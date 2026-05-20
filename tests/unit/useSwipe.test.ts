/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipe } from "@/lib/hooks/useSwipe";

describe("useSwipe", () => {
  it("should trigger onSwipeLeft when swiping left beyond threshold", () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }));

    // Mock touch start
    result.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
    } as any);

    // Mock touch end (swiping left means x decreases, but our logic uses start - end)
    // xDiff = 100 - 40 = 60 (> 50 threshold)
    result.current.onTouchEnd({
      changedTouches: [{ clientX: 40, clientY: 100 }],
    } as any);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it("should trigger onSwipeRight when swiping right beyond threshold", () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight }));

    // xDiff = 100 - 160 = -60
    result.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
    } as any);

    result.current.onTouchEnd({
      changedTouches: [{ clientX: 160, clientY: 100 }],
    } as any);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it("should not trigger horizontal swipe when vertical movement is greater", () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }));

    // xDiff = 100 - 40 = 60
    // yDiff = 100 - 20 = 80
    // |yDiff| > |xDiff| -> vertical swipe
    result.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
    } as any);

    result.current.onTouchEnd({
      changedTouches: [{ clientX: 40, clientY: 20 }],
    } as any);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("should respect custom threshold", () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipe({ onSwipeLeft }, { threshold: 100 }),
    );

    // xDiff = 60 (less than 100)
    result.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
    } as any);

    result.current.onTouchEnd({
      changedTouches: [{ clientX: 40, clientY: 100 }],
    } as any);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
