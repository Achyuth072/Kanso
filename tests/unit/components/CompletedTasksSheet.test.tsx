import { render, screen } from "@testing-library/react";
import { CompletedTasksSheet } from "@/components/tasks/CompletedTasksSheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/AuthProvider";
import { mockStore } from "@/lib/mock/mock-store";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock react-virtuoso
vi.mock("react-virtuoso", () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div>
      {data.map((item: any, index: number) => (
        <div key={item.id || index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

// Mock Supabase
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

// Mock hooks that might cause issues
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true), // Desktop mode
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn() })),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("CompletedTasksSheet (Logbook)", () => {
  beforeEach(() => {
    queryClient.clear();
    mockStore.clearData();
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("should NOT show tasks completed today", async () => {
    // Given: A task completed today and a task completed yesterday
    const now = new Date();
    const todayStr = now.toISOString();
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString();

    mockStore.addTask({
      id: "completed-today",
      content: "Completed Today Task",
      is_completed: true,
      completed_at: todayStr,
    });
    mockStore.addTask({
      id: "completed-yesterday",
      content: "Completed Yesterday Task",
      is_completed: true,
      completed_at: yesterdayStr,
    });

    // When: Logbook is opened
    render(
      <Wrapper>
        <CompletedTasksSheet open={true} onOpenChange={() => {}} />
      </Wrapper>,
    );

    // Then: It should show the yesterday task but NOT the today task
    // Wait for the query to finish
    const yesterdayTask = await screen.findByText("Completed Yesterday Task");
    expect(yesterdayTask).toBeDefined();

    // The today task should be filtered out
    const todayTask = screen.queryByText("Completed Today Task");
    expect(todayTask).toBeNull();
  });
});
