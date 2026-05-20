import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTimeFormat } from "@/lib/hooks/useTimeFormat";
import { useUiStore } from "@/lib/store/uiStore";

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

describe("useTimeFormat", () => {
  it("formats 14:30 as '2:30 PM' when 12h is selected", () => {
    vi.mocked(useUiStore).mockImplementation((selector: any) =>
      selector({ timeFormat: "12h" }),
    );
    const { result } = renderHook(() => useTimeFormat());
    const date = new Date("2026-05-05T14:30:00");
    expect(result.current.formatTime(date)).toBe("2:30 PM");
  });

  it("formats 14:30 as '14:30' when 24h is selected", () => {
    vi.mocked(useUiStore).mockImplementation((selector: any) =>
      selector({ timeFormat: "24h" }),
    );
    const { result } = renderHook(() => useTimeFormat());
    const date = new Date("2026-05-05T14:30:00");
    expect(result.current.formatTime(date)).toBe("14:30");
  });

  it("handles midnight correctly in 12h (12:00 AM)", () => {
    vi.mocked(useUiStore).mockImplementation((selector: any) =>
      selector({ timeFormat: "12h" }),
    );
    const { result } = renderHook(() => useTimeFormat());
    const date = new Date("2026-05-05T00:00:00");
    expect(result.current.formatTime(date)).toBe("12:00 AM");
  });

  it("handles midnight correctly in 24h (00:00)", () => {
    vi.mocked(useUiStore).mockImplementation((selector: any) =>
      selector({ timeFormat: "24h" }),
    );
    const { result } = renderHook(() => useTimeFormat());
    const date = new Date("2026-05-05T00:00:00");
    expect(result.current.formatTime(date)).toBe("00:00");
  });
});
