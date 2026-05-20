import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUiStore } from "@/lib/store/uiStore";

// Mock dependencies
let mockHapticsEnabled = true;

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector) => {
    const state = {
      hapticsEnabled: mockHapticsEnabled,
    };
    return typeof selector === "function" ? selector(state) : state;
  }),
}));

const mockIsPhone = vi.fn(() => true);
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mockIsPhone(),
}));

describe("useHaptic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHapticsEnabled = true;

    // Setup navigator.vibrate mock
    if (typeof window !== "undefined") {
      Object.defineProperty(window.navigator, "vibrate", {
        writable: true,
        value: vi.fn(),
      });
    }
  });

  it("should trigger vibration when enabled and on phone", () => {
    // Given: haptics enabled and environment is a phone
    mockHapticsEnabled = true;
    mockIsPhone.mockReturnValue(true);
    const { result } = renderHook(() => useHaptic());

    // When: trigger is called with a pattern
    result.current.trigger("toggle");

    // Then: navigator.vibrate should be called with that pattern's value
    expect(window.navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it("should NOT trigger vibration when disabled in settings", () => {
    // Given: haptics disabled in store
    mockHapticsEnabled = false;
    mockIsPhone.mockReturnValue(true);
    const { result } = renderHook(() => useHaptic());

    // When: trigger is called
    result.current.trigger("thud");

    // Then: navigator.vibrate should NOT be called
    expect(window.navigator.vibrate).not.toHaveBeenCalled();
  });

  it("should NOT trigger vibration when NOT on a phone (desktop)", () => {
    // Given: haptics enabled but environment is NOT a phone
    mockHapticsEnabled = true;
    mockIsPhone.mockReturnValue(false);
    const { result } = renderHook(() => useHaptic());

    // When: trigger is called
    result.current.trigger("tick");

    // Then: navigator.vibrate should NOT be called
    expect(window.navigator.vibrate).not.toHaveBeenCalled();
  });

  it("should handle 'success' signature", () => {
    // Given: signatures enabled
    mockIsPhone.mockReturnValue(true);
    const { result } = renderHook(() => useHaptic());

    // When: trigger is called with 'success'
    result.current.trigger("success");

    // Then: navigator.vibrate should be called with the success pattern [10, 50]
    expect(window.navigator.vibrate).toHaveBeenCalledWith([10, 50]);
  });
});
