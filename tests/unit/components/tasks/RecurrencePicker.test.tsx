import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecurrencePicker from "@/components/tasks/TaskSheet/RecurrencePicker";
import "@testing-library/jest-dom";
import React from "react";

// Mock hooks
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// Mock Popover to simplify testing
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover">{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

describe("RecurrencePicker Repetition State", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getTriggerButton = () => {
    const trigger = screen.getByTestId("popover-trigger");
    return within(trigger).getByRole("button");
  };

  it("should show inactive state when value is null", () => {
    // Given: value is null
    render(
      <RecurrencePicker value={null} onChange={mockOnChange} variant="icon" />,
    );

    // Then: Button should have inactive tooltip and classes
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Does not repeat");
    // Class check - inactive state should have text-muted-foreground
    expect(button.className).toContain("text-muted-foreground");
    expect(button.className).not.toContain("text-brand");
  });

  it("should show inactive state when value is undefined", () => {
    // Given: value is undefined
    render(
      <RecurrencePicker
        value={undefined as never}
        onChange={mockOnChange}
        variant="icon"
      />,
    );

    // Then: Button should be inactive (Fix verification)
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Does not repeat");
    expect(button.className).toContain("text-muted-foreground");
    expect(button.className).not.toContain("text-brand");
  });

  it("should show active state when a recurrence rule is provided", () => {
    // Given: a Daily recurrence rule
    const rule = { freq: "DAILY" as const, interval: 1 };

    render(
      <RecurrencePicker value={rule} onChange={mockOnChange} variant="icon" />,
    );

    // Then: Button should show brand colors and 'D' badge
    const button = getTriggerButton();
    expect(button).toHaveAttribute("title", "Daily");
    expect(button.className).toContain("text-brand");
    expect(within(button).getByText("D")).toBeInTheDocument();
  });
});
