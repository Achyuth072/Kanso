import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCurrentTime } from "@/lib/hooks/useCurrentTime";

describe("useCurrentTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed system time for consistent testing
    const date = new Date("2026-01-29T10:00:00Z");
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Given: Initial mount
  // When:  The hook is called
  // Then:  It returns the current system time
  it("should return initial current time on mount", () => {
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toEqual(new Date("2026-01-29T10:00:00Z"));
  });

  // Given: Interval of 60 seconds
  // When:  60 seconds pass
  // Then:  The time state updates
  it("should update time after the specified interval", () => {
    const { result } = renderHook(() => useCurrentTime(60000));

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current).toEqual(new Date("2026-01-29T10:01:00Z"));
  });

  // Given: Component unmount
  // When:  The component is unmounted
  // Then:  The interval is cleared
  it("should clear interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useCurrentTime());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
