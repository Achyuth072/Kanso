import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HabitIconPicker } from "@/components/habits/shared/HabitIconPicker";

describe("HabitIconPicker", () => {
  const mockOnChange = vi.fn();

  // Given: Default props in hero variant
  // When: Rendering the icon picker
  // Then: Should show the current icon prominently
  it("renders with a hero variant showing current icons", () => {
    render(
      <HabitIconPicker
        value="Flame"
        onChange={mockOnChange}
        color="#4B6CB7"
        variant="hero"
      />,
    );
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(1);
    const selectedIcon = screen.getByLabelText("Flame");
    expect(selectedIcon).toHaveAttribute("aria-checked", "true");
  });

  // Given: An icon is clicked in the grid
  // When: User selection happens
  // Then: onChange should be called with the icon name
  it("calls onChange when an icon is selected from the grid", () => {
    render(
      <HabitIconPicker
        value="Flame"
        onChange={mockOnChange}
        color="#4B6CB7"
        variant="hero"
      />,
    );
    const heartButton = screen.getByLabelText("Heart");
    fireEvent.click(heartButton);
    expect(mockOnChange).toHaveBeenCalledWith("Heart");
  });

  // Given: Compact variant is requested
  // When: Rendering the component
  // Then: Should not show the "Icon" label
  it("does not render label in compact variant", () => {
    render(
      <HabitIconPicker
        value="Flame"
        onChange={mockOnChange}
        color="#4B6CB7"
        variant="compact"
      />,
    );
    expect(screen.queryByText("Icon")).not.toBeInTheDocument();
  });
});
