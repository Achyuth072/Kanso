import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventOverflowPopover } from "@/components/calendar/EventOverflowPopover";
import type { CalendarEvent } from "@/lib/calendar/types";

// Mock useHaptic to avoid navigator.vibrate issues
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

describe("EventOverflowPopover", () => {
  const mockEvents: CalendarEvent[] = [
    {
      id: "4",
      title: "Event 4",
      start: new Date("2024-01-01T14:00:00"),
      end: new Date("2024-01-01T15:00:00"),
      color: "#00ff00",
      allDay: false,
    },
    {
      id: "5",
      title: "Event 5",
      start: new Date("2024-01-01T16:00:00"),
      end: new Date("2024-01-01T17:00:00"),
      color: "#0000ff",
      allDay: false,
    },
  ];

  it("TC-N-01: renders the '+X more' text correctly", () => {
    // Given
    render(
      <EventOverflowPopover
        remainingEvents={mockEvents}
        day={new Date("2024-01-01")}
      />,
    );

    // Then
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("TC-N-02: opens the popover when clicked", async () => {
    // Given
    render(
      <EventOverflowPopover
        remainingEvents={mockEvents}
        day={new Date("2024-01-01")}
      />,
    );

    // When
    const trigger = screen.getByText("+2 more");
    fireEvent.click(trigger);

    // Then
    // Radix Popover renders in a portal, so we check for content
    expect(await screen.findByText("Mon, Jan 1")).toBeInTheDocument();
    expect(screen.getByText("Event 4")).toBeInTheDocument();
    expect(screen.getByText("Event 5")).toBeInTheDocument();
  });

  it("TC-B-01: does not render anything if remainingEvents is empty", () => {
    // Given
    const { container } = render(
      <EventOverflowPopover
        remainingEvents={[]}
        day={new Date("2024-01-01")}
      />,
    );

    // Then
    expect(container).toBeEmptyDOMElement();
  });
});
