import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskDatePicker } from "@/components/tasks/shared/TaskDatePicker";
import React from "react";

// Mock the Popover components from Radix UI
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({
    children,
    align,
    sideOffset,
    collisionPadding,
  }: {
    children: React.ReactNode;
    align: string;
    sideOffset: number;
    collisionPadding: number;
  }) => (
    <div
      data-testid="popover-content"
      data-align={align}
      data-side-offset={sideOffset}
      data-collision-padding={collisionPadding}
    >
      {children}
    </div>
  ),
}));

// Mock DateTimeWizard
vi.mock("@/components/ui/date-time-wizard", () => ({
  DateTimeWizard: () => <div data-testid="datetime-wizard">Wizard</div>,
}));

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("TaskDatePicker", () => {
  const defaultProps = {
    date: undefined,
    setDate: vi.fn(),
    isMobile: false,
    open: true,
    onOpenChange: vi.fn(),
  };

  it("should use center alignment by default to prevent viewport clipping", () => {
    // Given: TaskDatePicker is rendered on desktop
    // When: The component is rendered
    render(<TaskDatePicker {...defaultProps} />);

    // Then: PopoverContent should have align="center"
    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent.getAttribute("data-align")).toBe("center");
  });
});
