import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivityHeatmap } from "@/components/stats/ActivityHeatmap";
import { useHeatmapData } from "@/lib/hooks/useHeatmapData";

// Mock react-activity-calendar
vi.mock("react-activity-calendar", () => ({
  ActivityCalendar: ({ data, theme }: { data: unknown[]; theme: object }) => (
    <div
      data-testid="activity-calendar"
      data-count={data.length}
      data-has-theme={!!theme}
    >
      ActivityCalendar Mock
    </div>
  ),
}));

// Mock tooltips CSS
vi.mock("react-activity-calendar/tooltips.css", () => ({}));

// Mock react-tooltip
vi.mock("react-tooltip", () => ({
  Tooltip: () => <div data-testid="tooltip" />,
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

// Mock the hook
vi.mock("@/lib/hooks/useHeatmapData", () => ({
  useHeatmapData: vi.fn(),
}));

describe("ActivityHeatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render skeleton when loading", () => {
    vi.mocked(useHeatmapData).mockReturnValue({
      data: [],
      isLoading: true,
      maxValue: { combined: 0, focus: 0, tasks: 0 },
      activeDays: 0,
      totalDays: 365,
    });
    render(<ActivityHeatmap />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should render ActivityCalendar when data loaded", () => {
    const mockData = Array.from({ length: 365 }, (_, i) => {
      const date = new Date(2026, 0, 1);
      date.setDate(date.getDate() + i);
      return {
        date: date.toISOString().split("T")[0],
        combined: Math.random() * 10,
        focus: Math.random() * 5,
        tasks: Math.floor(Math.random() * 5),
      };
    });

    vi.mocked(useHeatmapData).mockReturnValue({
      data: mockData,
      isLoading: false,
      maxValue: { combined: 10, focus: 5, tasks: 5 },
      activeDays: 180,
      totalDays: 365,
    });

    render(<ActivityHeatmap />);
    expect(screen.getByTestId("activity-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("activity-calendar")).toHaveAttribute(
      "data-count",
      "365",
    );
  });

  it("should display active days count", () => {
    vi.mocked(useHeatmapData).mockReturnValue({
      data: [{ date: "2026-01-01", combined: 5, focus: 2, tasks: 3 }],
      isLoading: false,
      maxValue: { combined: 10, focus: 5, tasks: 5 },
      activeDays: 42,
      totalDays: 365,
    });

    render(<ActivityHeatmap />);
    expect(
      screen.getByText("42 active days in the past year"),
    ).toBeInTheDocument();
  });

  it("should use monochromatic theme", () => {
    vi.mocked(useHeatmapData).mockReturnValue({
      data: [{ date: "2026-01-01", combined: 5, focus: 2, tasks: 3 }],
      isLoading: false,
      maxValue: { combined: 10, focus: 5, tasks: 5 },
      activeDays: 1,
      totalDays: 365,
    });

    render(<ActivityHeatmap />);
    expect(screen.getByTestId("activity-calendar")).toHaveAttribute(
      "data-has-theme",
      "true",
    );
  });
});
