import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAutoLockTimer } from "@/lib/hooks/useAutoLockTimer";

describe("useAutoLockTimer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when disabled", () => {
    const onTimeout = vi.fn();
    renderHook(() => useAutoLockTimer(false, 30, onTimeout));

    vi.advanceTimersByTime(60 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("fires once idle time crosses the interval", () => {
    const onTimeout = vi.fn();
    renderHook(() => useAutoLockTimer(true, 30, onTimeout));

    vi.advanceTimersByTime(30 * 60_000 + 15_000);
    expect(onTimeout).toHaveBeenCalled();
  });

  it("does not fire before the interval elapses", () => {
    const onTimeout = vi.fn();
    renderHook(() => useAutoLockTimer(true, 30, onTimeout));

    vi.advanceTimersByTime(10 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("resets the idle clock on user activity, delaying the timeout", () => {
    const onTimeout = vi.fn();
    renderHook(() => useAutoLockTimer(true, 30, onTimeout));

    vi.advanceTimersByTime(25 * 60_000);
    window.dispatchEvent(new Event("keydown"));

    vi.advanceTimersByTime(10 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(21 * 60_000);
    expect(onTimeout).toHaveBeenCalled();
  });
});
