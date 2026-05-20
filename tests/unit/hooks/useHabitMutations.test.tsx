/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useMarkHabitComplete,
} from "@/lib/hooks/useHabitMutations";

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

describe("useHabitMutations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useCreateHabit", () => {
    describe("TC-N-01: Create habit with valid data", () => {
      it("should create habit and invalidate queries", async () => {
        // Given: Authenticated user creating a habit
        const mockUser = { id: "user-1" };
        const newHabit = {
          id: "habit-1",
          user_id: "user-1",
          name: "Morning Workout",
          description: "Daily exercise",
          color: "#10b981",
          icon: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          archived_at: null,
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockInsert = vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: newHabit, error: null }),
          })),
        }));

        mockCreateClient.mockReturnValue({
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: { user: mockUser } },
              error: null,
            }),
            getUser: vi
              .fn()
              .mockResolvedValue({ data: { user: mockUser }, error: null }),
          },
          from: vi.fn(() => ({
            insert: mockInsert,
          })),
        } as any);

        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        // When: Mutation is called
        const { result } = renderHook(() => useCreateHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync({
            name: "Morning Workout",
            description: "Daily exercise",
            color: "#10b981",
          });
        });

        // Then: Habit is created and queries invalidated
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: "user-1",
          name: "Morning Workout",
          description: "Daily exercise",
          color: "#10b981",
          icon: null,
          start_date: expect.any(String),
        });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] });
      });
    });

    describe("TC-N-05: Guest mode - create habit", () => {
      it("should create habit successfully in guest mode", async () => {
        // Given: User in guest mode
        mockUseAuth.mockReturnValue({ isGuestMode: true } as any);
        localStorage.setItem("kanso_guest_mode", "true");

        const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

        // When: Mutation is called
        const { result } = renderHook(() => useCreateHabit(), { wrapper });

        let createdHabit: any;
        await act(async () => {
          createdHabit = await result.current.mutateAsync({
            name: "Guest Habit",
            description: "A habit for guest",
          });
        });

        // Then: Habit is created via mockStore and queries invalidated
        expect(createdHabit).toBeDefined();
        expect(createdHabit.name).toBe("Guest Habit");
        expect(createdHabit.id).toContain("guest-habit");
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["habits"] });
      });
    });
  });

  describe("useUpdateHabit", () => {
    describe("TC-N-02: Update habit metadata", () => {
      it("should update habit successfully", async () => {
        // Given: Authenticated user updating a habit
        const updatedHabit = {
          id: "habit-1",
          name: "Updated Name",
          description: "Updated description",
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockUpdate = vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi
                .fn()
                .mockResolvedValue({ data: updatedHabit, error: null }),
            })),
          })),
        }));

        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            update: mockUpdate,
          })),
        } as any);

        // When: Mutation is called
        const { result } = renderHook(() => useUpdateHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync({
            id: "habit-1",
            name: "Updated Name",
            description: "Updated description",
          });
        });

        // Then: Update is performed
        expect(mockUpdate).toHaveBeenCalledWith({
          name: "Updated Name",
          description: "Updated description",
        });
      });
    });
  });

  describe("useDeleteHabit", () => {
    describe("TC-N-03: Delete habit with optimistic update", () => {
      it("should remove from cache and delete from DB", async () => {
        // Given: Habit exists in cache
        const existingHabits = [
          { id: "habit-1", name: "Habit 1", entries: [] },
          { id: "habit-2", name: "Habit 2", entries: [] },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        const mockDelete = vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }));

        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            delete: mockDelete,
          })),
        } as any);

        // When: Delete mutation is called
        const { result } = renderHook(() => useDeleteHabit(), { wrapper });

        await act(async () => {
          await result.current.mutateAsync("habit-1");
        });

        // Then: Habit is removed from cache and DB
        const cacheData = queryClient.getQueryData([
          "habits",
          { includeArchived: false, isGuestMode: false },
        ]);
        expect(cacheData).toHaveLength(1);
        expect(mockDelete).toHaveBeenCalled();
      });
    });

    describe("TC-E-02: Delete with rollback on error", () => {
      it("should revert cache on error", async () => {
        // Given: Habit exists in cache, delete will fail
        const existingHabits = [
          { id: "habit-1", name: "Habit 1", entries: [] },
          { id: "habit-2", name: "Habit 2", entries: [] },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            delete: vi.fn(() => ({
              eq: vi
                .fn()
                .mockResolvedValue({ error: { message: "Delete failed" } }),
            })),
          })),
        } as any);

        // When: Delete mutation fails
        const { result } = renderHook(() => useDeleteHabit(), { wrapper });

        await act(async () => {
          try {
            await result.current.mutateAsync("habit-1");
          } catch (e) {
            // Expected to fail
          }
        });

        // Then: Cache is reverted to original state
        await waitFor(() => {
          const cacheData = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cacheData).toEqual(existingHabits);
        });
      });
    });
  });

  describe("useMarkHabitComplete", () => {
    describe("TC-N-04: Mark habit complete with optimistic update", () => {
      it("should upsert entry and update cache optimistically", async () => {
        // Given: Habit with existing entries
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            entries: [
              {
                id: "entry-1",
                habit_id: "habit-1",
                date: "2024-01-14",
                value: 1,
                created_at: "2024-01-14T10:00:00Z",
              },
            ],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        const newEntry = {
          id: "entry-2",
          habit_id: "habit-1",
          date: "2024-01-15",
          value: 1,
          created_at: "2024-01-15T10:00:00Z",
        };

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: newEntry, error: null }),
              })),
            })),
          })),
        } as any);

        // When: Mark complete mutation is called
        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          await result.current.mutateAsync({
            habitId: "habit-1",
            date: "2024-01-15",
            value: 1,
          });
        });

        // Then: Entry is added to cache
        const cacheData: any = queryClient.getQueryData([
          "habits",
          { includeArchived: false, isGuestMode: false },
        ]);
        expect(cacheData[0].entries).toHaveLength(2);
      });
    });

    describe("TC-E-03: Mark complete with rollback on error", () => {
      it("should revert cache on upsert error", async () => {
        // Given: Habit exists, upsert will fail
        const existingHabits = [
          {
            id: "habit-1",
            name: "Habit 1",
            entries: [],
          },
        ];

        queryClient.setQueryData(
          ["habits", { includeArchived: false, isGuestMode: false }],
          existingHabits,
        );

        mockUseAuth.mockReturnValue({ isGuestMode: false } as any);
        mockCreateClient.mockReturnValue({
          from: vi.fn(() => ({
            upsert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Upsert failed" },
                }),
              })),
            })),
          })),
        } as any);

        // When: Mutation fails
        const { result } = renderHook(() => useMarkHabitComplete(), {
          wrapper,
        });

        await act(async () => {
          try {
            await result.current.mutateAsync({
              habitId: "habit-1",
              date: "2024-01-15",
              value: 1,
            });
          } catch (e) {
            // Expected
          }
        });

        // Then: Cache is reverted
        await waitFor(() => {
          const cacheData = queryClient.getQueryData([
            "habits",
            { includeArchived: false, isGuestMode: false },
          ]);
          expect(cacheData).toEqual(existingHabits);
        });
      });
    });
  });
});
