import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReorderTasks } from "@/lib/hooks/useTaskMutations";
import { computeReorderPairs } from "@/lib/utils/task-dnd";
import type { Task } from "@/lib/types/task";
import React from "react";

// Mock dependencies
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "test-user" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    reorder: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const makeTask = (
  id: string,
  dayOrder: number,
  extra: Partial<Task> = {},
): Partial<Task> => ({
  id,
  content: `Task ${id}`,
  day_order: dayOrder,
  ...extra,
});

describe("useReorderTasks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("optimistically reorders tasks in cache on mutate", async () => {
    // Seed cache with tasks
    const initialTasks = [makeTask("1", 0), makeTask("2", 1), makeTask("3", 2)];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Reorder: move Task 3 to first position using slot-value-swap pairs
    const pairs = computeReorderPairs(["3", "1", "2"], initialTasks as Task[]);
    result.current.mutate(pairs);

    // Check cache was updated optimistically
    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
      expect(cached?.[0]?.id).toBe("3");
      expect(cached?.[1]?.id).toBe("1");
      expect(cached?.[2]?.id).toBe("2");
    });
  });

  it("rolls back cache on mutation error", async () => {
    const { taskMutations } = await import("@/lib/mutations/task");
    vi.mocked(taskMutations.reorder).mockRejectedValueOnce(
      new Error("Network error"),
    );

    // Seed cache with tasks
    const initialTasks = [makeTask("1", 0), makeTask("2", 1)];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Attempt reorder that will fail
    const pairs = computeReorderPairs(["2", "1"], initialTasks as Task[]);
    result.current.mutate(pairs);

    // Wait for error handling
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Cache should be rolled back to original order
    const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
    expect(cached?.[0]?.id).toBe("1");
    expect(cached?.[1]?.id).toBe("2");
  });

  it("slot-value-swap: task receives the day_order of the slot it moves into", async () => {
    // This is the core correctness property of the slot-value-swap algorithm.
    // Each task in the new order receives the day_order value from the slot it
    // is moving into. The SET of day_order values in the affected slots stays
    // constant — only which task holds which value changes.
    //
    // This prevents cross-section ordering corruption: tasks from other
    // sections/groups whose day_order values are not in this slot set remain
    // undisturbed after the server resorts by day_order.
    const initialTasks = [makeTask("1", 0), makeTask("2", 1), makeTask("3", 2)];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Reorder: C, A, B  (3→slot0, 1→slot1, 2→slot2)
    const pairs = computeReorderPairs(["3", "1", "2"], initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
      // Visual order is correct
      expect(cached?.[0]?.id).toBe("3");
      expect(cached?.[1]?.id).toBe("1");
      expect(cached?.[2]?.id).toBe("2");
      // day_order values follow the slot-value-swap: each task gets the
      // day_order of the slot it moved into.
      // Task 3 moved into slot 0 (day_order was 0) → day_order = 0
      expect(cached?.[0]?.day_order).toBe(0);
      // Task 1 moved into slot 1 (day_order was 1) → day_order = 1
      expect(cached?.[1]?.day_order).toBe(1);
      // Task 2 moved into slot 2 (day_order was 2) → day_order = 2
      expect(cached?.[2]?.day_order).toBe(2);
    });
  });

  it("does not reorder tasks outside orderedIds — cross-section regression guard", async () => {
    // This is the core regression test.
    //
    // Scenario: two groups (Critical + High) both have tasks with day_order
    // values that collide (both start from 0). User reorders only the High group.
    // The optimistic update must NOT change the order or position of Critical tasks.
    //
    // The old implementation assigned day_order = 0,1,2... to orderedIds tasks
    // then sorted ALL tasks by day_order. This caused Critical tasks (also with
    // day_order 0,1) to interleave with the newly-reordered High tasks.
    const initialTasks = [
      // Critical group (priority 1) — day_orders 0,1
      makeTask("c1", 0, { priority: 1 }),
      makeTask("c2", 1, { priority: 1 }),
      // High group (priority 2) — day_orders 2,3 (but could be 0,1 in fresh data)
      makeTask("h1", 2, { priority: 2 }),
      makeTask("h2", 3, { priority: 2 }),
    ];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // User drags h2 above h1 within the High group only
    const pairs = computeReorderPairs(["h2", "h1"], initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
      expect(cached).toBeDefined();

      // Critical tasks must remain at positions 0 and 1, untouched
      expect(cached?.[0]?.id).toBe("c1");
      expect(cached?.[1]?.id).toBe("c2");

      // High tasks must be reordered: h2 before h1 (positions 2 and 3)
      expect(cached?.[2]?.id).toBe("h2");
      expect(cached?.[3]?.id).toBe("h1");

      // Critical tasks' day_order values unchanged
      expect(cached?.[0]?.day_order).toBe(0);
      expect(cached?.[1]?.day_order).toBe(1);
      // High tasks receive the day_order values of the slots they moved into
      // h2 moves into slot 2 (day_order=2), h1 moves into slot 3 (day_order=3)
      expect(cached?.[2]?.day_order).toBe(2);
      expect(cached?.[3]?.day_order).toBe(3);
    });
  });

  it("handles cross-section reorder with overlapping day_order=0 values", async () => {
    // Stress test: all tasks have day_order=0 (fresh data, no prior reorder).
    // Reordering any subset must not corrupt the rest.
    const initialTasks = [
      makeTask("g1-a", 0, { priority: 1 }),
      makeTask("g1-b", 0, { priority: 1 }),
      makeTask("g2-a", 0, { priority: 2 }),
      makeTask("g2-b", 0, { priority: 2 }),
      makeTask("g3-a", 0, { priority: 3 }),
    ];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Reorder only group-2 tasks: swap g2-b before g2-a
    const pairs = computeReorderPairs(["g2-b", "g2-a"], initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
      expect(cached).toBeDefined();

      // Group 1 and group 3 tasks must be untouched
      expect(cached?.[0]?.id).toBe("g1-a");
      expect(cached?.[1]?.id).toBe("g1-b");
      // Group 2 tasks reordered in their original slots (positions 2 and 3)
      expect(cached?.[2]?.id).toBe("g2-b");
      expect(cached?.[3]?.id).toBe("g2-a");
      // Group 3 task untouched
      expect(cached?.[4]?.id).toBe("g3-a");
    });
  });
});

describe("computeReorderPairs", () => {
  it("computes correct pairs for a simple reorder", () => {
    const flatTasks: Task[] = [
      makeTask("a", 10) as Task,
      makeTask("b", 20) as Task,
      makeTask("c", 30) as Task,
    ];
    // Move c to front: [c, a, b]
    const pairs = computeReorderPairs(["c", "a", "b"], flatTasks);
    // c moves into slot 0 (day_order=10), a into slot 1 (day_order=20), b into slot 2 (day_order=30)
    expect(pairs).toEqual([
      { id: "c", day_order: 10 },
      { id: "a", day_order: 20 },
      { id: "b", day_order: 30 },
    ]);
  });

  it("only touches the slots of the given IDs — other tasks are not in the result", () => {
    const flatTasks: Task[] = [
      makeTask("x", 5) as Task,
      makeTask("a", 10) as Task,
      makeTask("y", 15) as Task,
      makeTask("b", 20) as Task,
    ];
    // Reorder only a and b (not x and y)
    const pairs = computeReorderPairs(["b", "a"], flatTasks);
    // a is at flat index 1 (day_order=10), b is at flat index 3 (day_order=20)
    // b moves into slot index 1 (day_order=10), a moves into slot index 3 (day_order=20)
    expect(pairs).toEqual([
      { id: "b", day_order: 10 },
      { id: "a", day_order: 20 },
    ]);
  });

  it("preserves day_order stability for tasks with non-sequential day_order values", () => {
    // Verifies that slot-value-swap correctly handles tasks with arbitrary
    // day_order gaps (e.g. after manual DB edits or partial reorders).
    // The SAME set of day_order values is redistributed — just re-assigned.
    const flatTasks: Task[] = [
      makeTask("p", 100) as Task,
      makeTask("q", 200) as Task,
      makeTask("r", 300) as Task,
    ];
    // Reverse the order: [r, q, p]
    const pairs = computeReorderPairs(["r", "q", "p"], flatTasks);
    // r moves into slot 0 (day_order=100), q into slot 1 (200), p into slot 2 (300)
    expect(pairs).toEqual([
      { id: "r", day_order: 100 },
      { id: "q", day_order: 200 },
      { id: "p", day_order: 300 },
    ]);
    // The set {100, 200, 300} is preserved — no new values introduced.
    // After DB re-sort, r(100) < q(200) < p(300) → correct order maintained.
  });
});
