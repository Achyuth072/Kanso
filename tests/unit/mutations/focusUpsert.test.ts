import { describe, it, expect, beforeEach, vi } from "vitest";
import { focusMutations } from "@/lib/mutations/focus";

// Hoist mock refs before vi.mock
const { mockUpsert, mockFrom, mockGetSession } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
}));

// Mock supabase client before any imports resolve
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom.mockReturnValue({
      upsert: mockUpsert,
    }),
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe("focusMutations.upsertTimerState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should call supabase.from('user_timer_state').upsert() with correct fields and onConflict", async () => {
    // Given: An authenticated user
    localStorage.removeItem("kanso_guest_mode");
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockUpsert.mockResolvedValue({ error: null });

    // When: upserting timer state
    await focusMutations.upsertTimerState({
      user_id: "user-1",
      mode: "focus",
      remaining_seconds: 1200,
      is_running: true,
      active_task_id: "task-1",
      updated_at: expect.any(String),
    });

    // Then: Should call the correct table and upsert with onConflict
    expect(mockFrom).toHaveBeenCalledWith("user_timer_state");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        mode: "focus",
        remaining_seconds: 1200,
        is_running: true,
        active_task_id: "task-1",
      }),
      { onConflict: "user_id" },
    );
  });

  it("should return early (no-op) for guest users", async () => {
    // Given: A guest user (localStorage flag set)
    localStorage.setItem("kanso_guest_mode", "true");

    // When: upserting timer state
    await focusMutations.upsertTimerState({
      user_id: "guest",
      mode: "focus",
      remaining_seconds: 1500,
      is_running: false,
      active_task_id: null,
    });

    // Then: Should NOT call supabase at all
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("should throw if no authenticated session", async () => {
    // Given: No guest mode, but no auth session either
    localStorage.removeItem("kanso_guest_mode");
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    // When/Then: Should throw
    await expect(
      focusMutations.upsertTimerState({
        user_id: "user-1",
        mode: "focus",
        remaining_seconds: 1500,
        is_running: false,
        active_task_id: null,
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
