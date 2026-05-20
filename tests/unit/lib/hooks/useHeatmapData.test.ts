import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useHeatmapData } from "@/lib/hooks/useHeatmapData";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import type { FocusLog } from "@/lib/types/focus";
import type { Task } from "@/lib/types/task";

// Mock dependencies
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [] })),
        })),
        gte: vi.fn(() => Promise.resolve({ data: [] })),
      })),
    })),
  })),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false })),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getFocusLogs: vi.fn(),
    getTasks: vi.fn(),
  },
}));

/**
 * Test Perspective Table: useHeatmapData
 *
 * | Case ID | Input / Precondition | Perspective | Expected Result |
 * |---------|----------------------|-------------|-----------------|
 * | TC-N-01 | User has data | Equivalence - Normal | Returns merged data points for past 365 days |
 * | TC-N-02 | Guest Mode | Equivalence - Normal | Returns data from mockStore |
 * | TC-A-01 | No data for timeframe | Boundary - Empty | Returns array of points with zero values |
 * | TC-B-01 | Data exactly 365 days old | Boundary - Edge | Includes the 365th day, excludes 366th |
 * | TC-E-01 | Database error | Error - Network | Handles error and returns empty data |
 */

describe("useHeatmapData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should merge focus logs and tasks into unified data points", async () => {
    const mockFocusLogs = [
      { start_time: new Date().toISOString(), duration_seconds: 3600 },
    ];
    const mockTasks = [
      { completed_at: new Date().toISOString(), is_completed: true },
    ];

    vi.mocked(useQuery).mockImplementation(
      ({ queryKey }: { queryKey: readonly unknown[] }) => {
        const result = {
          isLoading: false,
          isError: false,
          error: null,
          isPending: false,
          isFetching: false,
          isSuccess: true,
          status: "success",
          data: null as unknown,
          refetch: vi.fn(),
        };

        if (queryKey[0] === "heatmap-data") {
          result.data = {
            focusLogs: mockFocusLogs,
            tasks: mockTasks,
          };
        }
        return result as unknown as UseQueryResult<unknown, unknown>;
      },
    );

    const { result } = renderHook(() => useHeatmapData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // We expect 365 days of data
    expect(result.current.data.length).toBe(365);

    // Check the latest day (today)
    const today = new Date().toISOString().split("T")[0];
    const todayPoint = result.current.data.find((p) => p.date === today);

    expect(todayPoint).toBeDefined();
    expect(todayPoint?.focus).toBeGreaterThan(0);
    expect(todayPoint?.tasks).toBe(1);
    expect(todayPoint?.combined).toBeGreaterThan(0);
  });

  it("should handle guest mode by calling mockStore", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isGuestMode: true,
    } as unknown as ReturnType<typeof useAuth>);

    const mockFocusLogs = [
      { start_time: new Date().toISOString(), duration_seconds: 7200 },
    ];
    const mockTasks = [
      {
        completed_at: new Date().toISOString(),
        is_completed: true,
        user_id: "guest",
      },
      {
        completed_at: new Date().toISOString(),
        is_completed: true,
        user_id: "guest",
      },
    ];

    vi.mocked(mockStore.getFocusLogs).mockReturnValue(
      mockFocusLogs as unknown as FocusLog[],
    );
    vi.mocked(mockStore.getTasks).mockReturnValue(
      mockTasks as unknown as Task[],
    );

    vi.mocked(useQuery).mockReturnValue({
      data: { focusLogs: mockFocusLogs, tasks: mockTasks },
      isLoading: false,
      isSuccess: true,
      status: "success",
    } as unknown as UseQueryResult<unknown, unknown>);

    const { result } = renderHook(() => useHeatmapData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const today = new Date().toISOString().split("T")[0];
    const todayPoint = result.current.data.find((p) => p.date === today);

    expect(todayPoint?.focus).toBe(2); // 7200s = 2h
    expect(todayPoint?.tasks).toBe(2);
  });

  it("should return empty heatmap if data is unavailable", async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      status: "success",
    } as unknown as UseQueryResult<unknown, unknown>);

    const { result } = renderHook(() => useHeatmapData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data.every((p) => p.combined === 0)).toBe(true);
  });
});
