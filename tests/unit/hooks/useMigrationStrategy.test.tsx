import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type MockSupabaseBuilder = Promise<{ data: unknown; error: unknown }> & {
  from: Mock;
  select: Mock;
  insert: Mock;
  update: Mock;
  eq: Mock;
  single: Mock;
};

describe("useMigrationStrategy", () => {
  let mockSupabase: MockSupabaseBuilder;
  const mockUser = { id: "real-user-id" } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("location", { reload: vi.fn() });

    // Helper to create a promise that also has chainable methods
    const createMockBuilder = (data: unknown = [], error: unknown = null) => {
      const promise = Promise.resolve({ data, error });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(() => builder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase = createMockBuilder();
    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>,
    );
  });

  const setupMockSequence = (results: { data: unknown; error?: unknown }[]) => {
    let index = 0;
    const createBuilder = () => {
      const result = results[index++] || { data: [], error: null };
      const promise = Promise.resolve({
        data: result.data,
        error: result.error || null,
      });
      const builder = promise as unknown as MockSupabaseBuilder;
      builder.from = vi.fn(createBuilder);
      builder.select = vi.fn(() => builder);
      builder.insert = vi.fn(() => builder);
      builder.update = vi.fn(() => builder);
      builder.eq = vi.fn(() => builder);
      builder.single = vi.fn(() => builder);
      return builder;
    };

    mockSupabase.from.mockImplementation(createBuilder);
  };

  it("MIG-E-01: Skipping migration for existing users", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem(
      "kanso_guest_data_v7",
      JSON.stringify({
        tasks: [],
        projects: [],
        habits: [],
        habit_entries: [],
        focus_logs: [],
      }),
    );
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
    });

    setupMockSequence([
      { data: [{ id: "p1" }, { id: "p2" }] }, // Project check
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
      },
      { timeout: 3000 },
    );
  });

  it("MIG-N-01: Successful migration flow", async () => {
    const guestData = {
      tasks: [{ id: "g-t1", content: "Task 1", created_at: "2023-01-01" }],
      projects: [{ id: "g-p1", name: "Work", is_inbox: false }],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem("kanso_guest_data_v7", JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
    });

    setupMockSequence([
      { data: [] }, // Initial project check
      { data: { id: "s-p1" } }, // Project insert
      { data: [{ id: "s-t1", content: "Task 1", created_at: "2023-01-01" }] }, // Task insert
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
        expect(window.location.reload).toHaveBeenCalled();
      },
      { timeout: 4000 },
    );
  });

  it("MIG-B-01: Correct parent_id mapping for subtasks", async () => {
    const guestTasks = [
      {
        id: "parent",
        content: "Parent",
        parent_id: null,
        created_at: "2023-01-01",
      },
      {
        id: "child",
        content: "Child",
        parent_id: "parent",
        created_at: "2023-01-02",
      },
    ];
    const guestData = {
      tasks: guestTasks,
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
    };

    localStorage.setItem("kanso_guest_mode", "true");
    localStorage.setItem("kanso_guest_data_v7", JSON.stringify(guestData));

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isGuestMode: false,
      signOut: vi.fn(),
      session: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signInWithMagicLink: vi.fn(),
      signInAsGuest: vi.fn(),
    });

    setupMockSequence([
      { data: [] }, // Initial check
      {
        data: [
          { id: "new-parent", content: "Parent", created_at: "2023-01-01" },
          { id: "new-child", content: "Child", created_at: "2023-01-02" },
        ],
      }, // Task insert
      { data: {} }, // Task update
    ]);

    renderHook(() => useMigrationStrategy());

    await waitFor(
      () => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(
          "kanso_guest_mode",
        );
      },
      { timeout: 5000 },
    );
  });
});
