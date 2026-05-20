import { renderHook, waitFor } from "@testing-library/react";
import { useTasks } from "@/lib/hooks/useTasks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { AuthProvider } from "@/components/AuthProvider";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("useTasks hook (Task Continuity Data)", () => {
  beforeEach(() => {
    queryClient.clear();
    mockStore.clearData();
    // Force Guest Mode for testing mockStore logic
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("should return today's completed tasks even when showCompleted is false", async () => {
    // Given: An active task and a task completed today
    const now = new Date();
    const todayStr = now.toISOString();

    mockStore.addTask({
      id: "active-1",
      content: "Active Task",
      is_completed: false,
    });
    mockStore.addTask({
      id: "completed-today",
      content: "Completed Today",
      is_completed: true,
      completed_at: todayStr,
    });
    mockStore.addTask({
      id: "completed-yesterday",
      content: "Completed Yesterday",
      is_completed: true,
      completed_at: new Date(now.getTime() - 86400000).toISOString(),
    });

    // When: useTasks is called with showCompleted: false (default)
    const { result } = renderHook(() => useTasks(), { wrapper });

    // Then: It should include the active task AND today's completed task
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const taskIds = result.current.data?.map((t) => t.id);
    expect(taskIds).toContain("active-1");

    // THIS IS THE BUG: Currently it filters out "completed-today"
    // We WANT it to contain "completed-today" for task continuity
    expect(taskIds).toContain("completed-today");
    expect(taskIds).not.toContain("completed-yesterday");
  });
});
