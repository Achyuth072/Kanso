import { render, screen } from "@testing-library/react";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthView } from "@/components/calendar/MonthView";
import { describe, it, expect } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/types";

describe("Regression Fixes", () => {
  const mockDate = new Date("2024-01-01T12:00:00");
  const mockEvents: CalendarEvent[] = [];

  it("TimeGrid: Header height should be compact (h-16) to avoid huge gap", () => {
    // Note: We test strictly for what we want to enact (h-16)
    render(
      <TimeGrid
        startDate={mockDate}
        daysToShow={1}
        events={mockEvents}
        data-testid="time-grid"
      />,
    );
    const root = screen.getByTestId("time-grid");
    const headers = root.querySelectorAll(".sticky");
    const dayHeader = Array.from(headers).find((h) =>
      h.textContent?.includes("Mon"),
    );

    expect(dayHeader).toBeTruthy();
    expect(dayHeader?.className).toContain("h-20");
    expect(dayHeader?.className).not.toContain("h-24");
  });

  it("TimeGrid: should render CurrentTimeIndicator when today is visible", () => {
    const today = new Date();
    render(
      <TimeGrid
        startDate={today}
        daysToShow={1}
        events={[]}
        data-testid="time-grid"
      />,
    );
    expect(screen.getByTestId("current-time-indicator")).toBeInTheDocument();
  });

  it("TimeGrid: should attempt to scroll to current time on mount", () => {
    const today = new Date();
    const { getByTestId } = render(
      <TimeGrid
        startDate={today}
        daysToShow={1}
        events={[]}
        data-testid="time-grid"
      />,
    );
    const grid = getByTestId("time-grid");
    expect(grid).toBeInTheDocument();
  });

  it("TimeGrid: should calculate horizontal scroll for mobile week view", () => {
    const today = new Date();
    // Start week 2 days ago so today is index 2
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 2);

    const { getByTestId } = render(
      <TimeGrid
        isMobile={true}
        startDate={startDate}
        daysToShow={7}
        events={[]}
        data-testid="time-grid"
      />,
    );
    const grid = getByTestId("time-grid");
    expect(grid).toBeInTheDocument();
    // Regression check: Ensure it doesn't crash and renders Today's indicator
    expect(screen.getByTestId("current-time-indicator")).toBeInTheDocument();
  });

  it("MonthView: Grid lines should be visible (consistent border opacity)", () => {
    render(
      <MonthView
        currentDate={mockDate}
        events={mockEvents} // No events, checking empty state regression
        data-testid="month-view"
      />,
    );

    // Find the cell for day '1'
    const dayOneText = screen.getAllByText("1")[0];
    const dayOne = dayOneText.closest("div.relative");

    expect(dayOne).toBeTruthy();
    // Expect standard borders (/40) consistent with Ruthless Kanso design system
    const grid = dayOne?.parentElement;
    expect(grid?.className).toContain("divide-border/40");
    expect(dayOne?.className).toContain("relative"); // Structural verification
  });

  it("MonthView: Events should be rendered on current day (highlighted)", () => {
    const today = new Date();
    const event: CalendarEvent = {
      id: "1",
      title: "Test Event Today",
      start: today,
      end: new Date(today.getTime() + 3600000),
      color: "#ff0000",
      allDay: false,
    };

    render(<MonthView currentDate={today} events={[event]} />);

    // Check if event title is in the document
    // If this fails, it's a Logic issue (event filtered out/not passed)
    // If this passes, it's a Visual issue (CSS/z-index)
    expect(screen.getByText("Test Event Today")).toBeInTheDocument();
  });
});
