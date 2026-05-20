/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHabits, useHabit } from "@/lib/hooks/useHabits";
import type { HabitWithEntries } from "@/lib/hooks/useHabits";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

const mockCreateClient = vi.mocked(createClient);
const mockUseAuth = vi.mocked(useAuth);

describe("useHabits", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("TC-N-01: Normal case - authenticated user with habits", () => {
    it("should return habits with entries", async () => {
      // Given: Authenticated user with existing habits
      const mockHabitsData = [
        {
          id: "habit-1",
          user_id: "user-1",
          name: "Morning Exercise",
          description: "Daily workout",
          color: "#10b981",
          icon: "💪",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          archived_at: null,
        },
      ];
      const mockEntriesData = [
        {
          id: "entry-1",
          habit_id: "habit-1",
          date: "2024-01-15",
          value: 1,
          created_at: "2024-01-15T10:00:00Z",
        },
      ];

      mockUseAuth.mockReturnValue({ isGuestMode: false } as any);

      const mockFrom = vi.fn((table: string) => {
        if (table === "habits") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            is: vi
              .fn()
              .mockResolvedValue({ data: mockHabitsData, error: null }),
          };
        }
        if (table === "habit_entries") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi
              .fn()
              .mockResolvedValue({ data: mockEntriesData, error: null }),
          };
        }
        return {};
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // When: Hook is called
      const { result } = renderHook(() => useHabits(), { wrapper });

      // Then: Returns habits with entries
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.[0].entries).toHaveLength(1);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("TC-N-02: Normal case - includeArchived option", () => {
    it("should return archived habits when includeArchived is true", async () => {
      // Given: User with archived and active habits
      const mockHabitsData = [
        { id: "habit-1", archived_at: null },
        { id: "habit-2", archived_at: "2024-01-10T00:00:00Z" },
      ];

      mockUseAuth.mockReturnValue({ isGuestMode: false } as any);

      const mockFrom = vi.fn((table: string) => {
        if (table === "habits") {
          return {
            select: vi.fn().mockReturnThis(),
            // When includeArchived is true, .is() is NOT called, so .order() MUST be the one that resolves
            order: vi
              .fn()
              .mockResolvedValue({ data: mockHabitsData, error: null }),
          };
        }
        if (table === "habit_entries") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // When: Hook is called with includeArchived=true
      const { result } = renderHook(
        () => useHabits({ includeArchived: true }),
        { wrapper },
      );

      // Then: All habits are returned
      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });
    });
  });

  describe("TC-N-03: Guest mode", () => {
    it("should return mock habits in guest mode", async () => {
      // Given: User is in guest mode
      mockUseAuth.mockReturnValue({ isGuestMode: true } as any);

      // When: Hook is called
      const { result } = renderHook(() => useHabits(), { wrapper });

      // Then: Returns mock habits from mockStore
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.length).toBeGreaterThan(0);
        expect(result.current.data?.[0].name).toContain("Drink Water");
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("TC-A-01: Boundary - no habits exist", () => {
    it("should return empty array when no habits exist", async () => {
      // Given: User with no habits
      mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
      mockCreateClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        })),
      } as any);

      // When: Hook is called
      const { result } = renderHook(() => useHabits(), { wrapper });

      // Then: Returns empty array
      await waitFor(() => {
        expect(result.current.data).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("TC-E-01: Error - database failure", () => {
    it("should throw error when database query fails", async () => {
      // Given: Database returns an error
      mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
      mockCreateClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Database connection failed" },
              }),
            })),
          })),
        })),
      } as any);

      // When: Hook is called
      const { result } = renderHook(() => useHabits(), { wrapper });

      // Then: Error is thrown
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.message).toContain(
          "Database connection failed",
        );
      });
    });
  });

  describe("useHabit - Single habit query", () => {
    it("should return mock habit for guest mode", async () => {
      // Given: Guest mode
      mockUseAuth.mockReturnValue({ isGuestMode: true } as any);

      // When: Hook is called with a default guest habit ID
      const { result } = renderHook(() => useHabit("habit-water"), { wrapper });

      // Then: Returns the mock habit
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.name).toContain("Drink Water");
      });
    });

    it("should return habit with entries for valid ID", async () => {
      // Given: Valid habit ID
      const mockHabitData = {
        id: "habit-1",
        name: "Test Habit",
      };
      const mockEntriesData = [
        { id: "entry-1", habit_id: "habit-1", date: "2024-01-15", value: 1 },
      ];

      mockUseAuth.mockReturnValue({ isGuestMode: false } as any);

      const mockFrom = vi.fn((table: string) => {
        if (table === "habits") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockHabitData, error: null }),
          };
        }
        if (table === "habit_entries") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi
              .fn()
              .mockResolvedValue({ data: mockEntriesData, error: null }),
          };
        }
        return {};
      });

      mockCreateClient.mockReturnValue({
        from: mockFrom,
      } as any);

      // When: Hook is called
      const { result } = renderHook(() => useHabit("habit-1"), { wrapper });

      // Then: Returns habit data
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        if (result.current.data) {
          expect(result.current.data.name).toBe("Test Habit");
          expect(result.current.data.entries).toHaveLength(1);
        }
      });
    });
  });
});
