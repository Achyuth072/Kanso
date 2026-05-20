/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MonthView } from "@/components/calendar/MonthView";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import React from "react";

// Mock hooks
vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(),
}));

vi.mock("@/lib/hooks/useSwipe", () => ({
  useSwipe: vi.fn(() => ({ onTouchStart: vi.fn(), onTouchEnd: vi.fn() })),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: vi.fn(() => ({
    next: vi.fn(),
    prev: vi.fn(),
  })),
}));

describe("MonthView Mobile Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show max 2 lines total (1 event + overflow) on mobile in compact month (6 weeks) when 3+ events exist", () => {
    (useIsMobile as any).mockReturnValue(true);

    // June 2024 has 6 weeks (Starts Sat June 1, Ends Sun June 30)
    const june2024 = new Date(2024, 5, 1);

    const events = [
      {
        id: "1",
        title: "Event 1",
        start: new Date(2024, 5, 10, 10, 0),
        end: new Date(2024, 5, 10, 11, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
      {
        id: "2",
        title: "Event 2",
        start: new Date(2024, 5, 10, 11, 0),
        end: new Date(2024, 5, 10, 12, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
      {
        id: "3",
        title: "Event 3",
        start: new Date(2024, 5, 10, 12, 0),
        end: new Date(2024, 5, 10, 13, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
    ];

    render(<MonthView currentDate={june2024} events={events} />);

    // Find cell for June 10
    const day10Button = screen.getByRole("button", { name: "10" });
    const day10Cell = day10Button.closest(".relative");
    expect(day10Cell).toBeTruthy();

    // EXPECTATION: 1 event visible, +2 more
    // Total lines below date header should be 2.

    const visibleEvents = within(day10Cell as HTMLElement).queryAllByText(
      /Event \d/,
    );
    const overflow = within(day10Cell as HTMLElement).queryByText(/\+\d more/);

    // Current buggy code shows 2 events AND overflow (Total 3)
    // We want: visibleEvents.length + (overflow ? 1 : 0) <= 2
    expect(visibleEvents.length).toBe(1);
    expect(overflow).toBeTruthy();
    expect(overflow?.textContent).toBe("+2 more");
  });

  it("should show max 3 lines total (2 events + overflow) on mobile in normal month (5 weeks) when 4+ events exist", () => {
    (useIsMobile as any).mockReturnValue(true);

    // May 2024 has 5 weeks (Starts Wed May 1, Ends Fri May 31)
    const may2024 = new Date(2024, 4, 1);

    const events = [
      {
        id: "1",
        title: "Event 1",
        start: new Date(2024, 4, 15, 10, 0),
        end: new Date(2024, 4, 15, 11, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
      {
        id: "2",
        title: "Event 2",
        start: new Date(2024, 4, 15, 11, 0),
        end: new Date(2024, 4, 15, 12, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
      {
        id: "3",
        title: "Event 3",
        start: new Date(2024, 4, 15, 12, 0),
        end: new Date(2024, 4, 15, 13, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
      {
        id: "4",
        title: "Event 4",
        start: new Date(2024, 4, 15, 13, 0),
        end: new Date(2024, 4, 15, 14, 0),
        allDay: false,
        color: "#4B6CB7",
        category: "event",
      },
    ];

    render(<MonthView currentDate={may2024} events={events} />);

    const day15Button = screen.getByRole("button", { name: "15" });
    const day15Cell = day15Button.closest(".relative");

    const visibleEvents = within(day15Cell as HTMLElement).queryAllByText(
      /Event \d/,
    );
    const overflow = within(day15Cell as HTMLElement).queryByText(/\+\d more/);

    // EXPECTATION: 2 events visible, +2 more
    // Total lines below date header should be 3.
    expect(visibleEvents.length).toBe(2);
    expect(overflow).toBeTruthy();
    expect(overflow?.textContent).toBe("+2 more");
  });
});
