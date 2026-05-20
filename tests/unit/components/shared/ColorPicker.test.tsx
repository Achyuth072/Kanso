import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ColorPicker } from "@/components/shared/ColorPicker";

describe("ColorPicker", () => {
  const mockOnChange = vi.fn();

  // Given: Standard colors and a value
  // When: Rendering the color picker
  // Then: All colors should be visible as swatches
  it("renders all color swatches", () => {
    render(<ColorPicker value="#4B6CB7" onChange={mockOnChange} />);
    expect(screen.getByText("Color")).toBeInTheDocument();
    const buttons = screen.getAllByRole("radio");
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  // Given: A specific color value is selected
  // When: Rendering the component
  // Then: The button corresponding to that color should have an active state
  it("shows the selected color as active", () => {
    const selectedColor = "#4B6CB7"; // Kanso Blue
    render(<ColorPicker value={selectedColor} onChange={mockOnChange} />);
    const selectedButton = screen.getByLabelText("Kanso Blue");
    expect(selectedButton).toHaveAttribute("aria-checked", "true");
  });

  // Given: A color swatch is clicked
  // When: User clicks the Emerald color
  // Then: onChange should be called with the Emerald hex code
  it("calls onChange when a color is clicked", () => {
    render(<ColorPicker value="#4B6CB7" onChange={mockOnChange} />);
    const terracottaButton = screen.getByLabelText("Terracotta");
    fireEvent.click(terracottaButton);
    expect(mockOnChange).toHaveBeenCalledWith("#B56C5A");
  });
});
