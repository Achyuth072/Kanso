import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import type { HabitEntry } from "@/lib/hooks/useHabits";

describe("HabitHeatmap Scroll Behavior", () => {
  let mockEntries: HabitEntry[];
  const startDate = "2025-01-20";
  const color = "#3b82f6";

  beforeEach(() => {
    mockEntries = [];
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (365 - i));
      mockEntries.push({
        id: `entry-${i}`,
        habit_id: "habit-1",
        date: date.toISOString().split("T")[0],
        value: 1,
        created_at: today.toISOString(),
      });
    }
  });

  it("should render with fit-content width to ensure correct overflow behavior", () => {
    // Given: A heatmap
    const { container } = render(
      <HabitHeatmap
        entries={mockEntries}
        color={color}
        startDate={startDate}
      />,
    );

    // When: The component renders
    const wrapper = container.firstChild as HTMLElement;

    // Then: It should use fit-content to let SVG drive width
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe("fit-content");
  });
});
