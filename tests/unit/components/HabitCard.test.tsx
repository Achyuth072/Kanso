import { render } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCard } from "@/components/habits/HabitCard";
import type { HabitWithEntries } from "@/lib/types/habit";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";

vi.mock("@/lib/hooks/useIsMobile");
vi.mock("@/lib/hooks/useHabitMutations");

describe("HabitCard Scroll Initialization", () => {
  let mockHabit: HabitWithEntries;

  beforeEach(() => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);

    mockHabit = {
      id: "habit-test",
      user_id: "user-test",
      name: "Test Habit",
      description: "Test description",
      color: "#3b82f6",
      icon: "Droplets",
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
      archived_at: null,
      start_date: startDate.toISOString().split("T")[0],
      entries: [],
    };
  });

  it("should use scrollbar-hide on desktop for premium look", async () => {
    // Given: A habit card on desktop
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    const { container } = render(<HabitCard habit={mockHabit} />);

    // Then: Scroll container should have scrollbar-hide (JS handles interaction)
    const scrollContainer = container.querySelector(
      ".overflow-x-auto",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain("scrollbar-hide");
    expect(scrollContainer.className).not.toContain("custom-scrollbar");
  });

  it("should use scrollbar-hide on mobile for clean UI", async () => {
    // Given: A habit card on mobile
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(true);
    const { container } = render(<HabitCard habit={mockHabit} />);

    // Then: Scroll container should have scrollbar-hide
    const scrollContainer = container.querySelector(
      ".overflow-x-auto",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain("scrollbar-hide");
    expect(scrollContainer.className).not.toContain("custom-scrollbar");
  });
});
