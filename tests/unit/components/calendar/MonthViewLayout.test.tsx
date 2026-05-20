import { render, screen } from "@testing-library/react";
import { MonthView } from "@/components/calendar/MonthView";
import { describe, it, expect } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/types";

describe("MonthView Mobile Layout Resolution", () => {
  const mockDate = new Date("2025-03-01T12:00:00"); // March 2025 starts on Saturday, has 6 rows
  const mockEvents: CalendarEvent[] = [
    {
      id: "1",
      title: "Event 1",
      start: new Date("2025-03-01T10:00:00"),
      end: new Date("2025-03-01T11:00:00"),
      allDay: false,
      color: "hsl(var(--primary))",
    },
  ];

  it("Grid container should have classes for proportional shrinking (min-h-0 overflow-hidden)", () => {
    // Given: A month with 6 rows
    render(
      <MonthView
        currentDate={mockDate}
        events={mockEvents}
        data-testid="month-view"
      />,
    );

    // When: Finding the grid container
    const monthView = screen.getByTestId("month-view");
    const grid = monthView.querySelector(".grid.grid-cols-7.border-b.border-r");

    // Then: It should have min-h-0 and overflow-hidden to prevent
    // enforced minimum content height from causing clipping
    expect(grid?.className).toContain("min-h-0");
    expect(grid?.className).toContain("overflow-hidden");
  });

  it("Day cells should have h-full instead of enforced min-height on mobile", () => {
    // Given: Component rendered
    render(<MonthView currentDate={mockDate} events={mockEvents} />);

    // When: Finding a day cell
    const dayCells = screen.getAllByText("1")[0].closest("div.relative");

    // Then: It should have h-full for proportional height distribution
    // and NOT min-h-[100px] which was the root cause of clipping
    expect(dayCells?.className).toContain("h-full");
    expect(dayCells?.className).not.toContain("min-h-[100px]");
  });

  it("Should render 6 rows for dates that span 6 weeks (e.g., March 2025)", () => {
    // Given: March 2025 (starts Saturday, ends Monday, 6 rows total)
    render(
      <MonthView
        currentDate={mockDate}
        events={mockEvents}
        data-testid="month-view"
      />,
    );

    // When: Finding the grid
    const monthView = screen.getByTestId("month-view");
    const grid = monthView.querySelector(".grid.grid-cols-7.border-b.border-r");

    // Then: It should have the repeat(6, 1fr) style
    expect((grid as HTMLElement)?.style.gridTemplateRows).toBe(
      "repeat(6, 1fr)",
    );

    // And all days (35 or 42 depending on how many leading/trailing are shown)
    // eachDayOfInterval will generate exactly the interval from startOfWeek to endOfWeek
    const allCells = grid?.children;
    expect(allCells?.length).toBe(42);
  });
});
