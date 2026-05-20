import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CurrentTimeIndicator } from "@/components/calendar/CurrentTimeIndicator";

describe("CurrentTimeIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Given: Time is 10:30 AM (local)
  // When:  Component is rendered
  // Then:  The line is at (10 * 120) + (0.5 * 120) + 64 = 1200 + 60 + 64 = 1324px
  it("renders at the correct vertical position for a given time", () => {
    const testDate = new Date(2026, 0, 29, 10, 30, 0);
    vi.setSystemTime(testDate);

    render(<CurrentTimeIndicator />);

    const container = screen.getByTestId("current-time-indicator");
    const style = window.getComputedStyle(container);

    expect(style.top).toBe("1324px");
  });

  // Given: Time is 00:00 (Midnight) (local)
  // When:  Component is rendered
  // Then:  Position = (0 * 120) + (0 * 120) + 64 = 64px
  it("renders at the correct vertical position for midnight", () => {
    const testDate = new Date(2026, 0, 29, 0, 0, 0);
    vi.setSystemTime(testDate);

    render(<CurrentTimeIndicator />);

    const container = screen.getByTestId("current-time-indicator");
    const style = window.getComputedStyle(container);

    expect(style.top).toBe("64px");
  });

  it("displays the current time text", () => {
    const testDate = new Date(2026, 0, 29, 14, 15, 0);
    vi.setSystemTime(testDate);

    render(<CurrentTimeIndicator />);

    // format(testDate, "h:mm a") -> "2:15 PM"
    expect(screen.getByText(/2:15\s*PM/i)).toBeInTheDocument();
  });
});
