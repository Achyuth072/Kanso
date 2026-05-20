import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReorderTasks } from "@/lib/hooks/useTaskMutations";
import { computeReorderPairs } from "@/lib/utils/task-dnd";
import type { Task } from "@/lib/types/task";
import React from "react";

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

/**
 * Regression test for Bug B (cross-board / cross-section reordering).
 *
 * Scenario: user drags a task FROM Critical INTO the middle of High.
 *
 *   Initial flat cache (priority,day_order):
 *     [c1 (1,0), c2 (1,1), h1 (2,2), h2 (2,3), h3 (2,4)]
 *
 *   User drags c2 from Critical and drops it between h1 and h2 in High.
 *
 *   Expected destination column order: [h1, c2, h2, h3]
 *   Expected updateTask.mutate is also dispatched to change c2.priority=2,
 *   but this test focuses ONLY on the reorder mutation's effect on cache:
 *   after the reorder, the destination group's order (when grouped by
 *   priority with c2.priority pre-set to 2) must match [h1, c2, h2, h3].
 *
 * The failure mode under the current implementation:
 *   computeReorderPairs(["h1","c2","h2","h3"], preDragFlat) collects slots
 *   where those IDs appear in preDragFlat:
 *     - c2 at flat-index 1 (Critical's slot)
 *     - h1 at flat-index 2
 *     - h2 at flat-index 3
 *     - h3 at flat-index 4
 *   slotDayOrders = [1, 2, 3, 4]  (taken in flat-array order, NOT in
 *   destination-column order)
 *   pairs = [{h1,1}, {c2,2}, {h2,3}, {h3,4}]
 *
 * After applying the reorder pairs to the cache (slot-overwrite), the cache
 * becomes (in flat order):
 *   [c1, h1, c2, h2, h3] with day_orders [0,1,2,3,4]
 *
 * When the consumer regroups by priority (with c2.priority=2 applied by the
 * concurrent updateTask mutation), the High group orders by day_order:
 *   h1(1) < c2(2) < h2(3) < h3(4)  →  [h1, c2, h2, h3]   ✓
 *
 * So in this isolated scenario the cache result IS correct. The test below
 * verifies that property holds.
 *
 * The user-visible bug therefore lies elsewhere — likely the visual flicker
 * during the brief window where invalidateQueries refetches and the server
 * returns tasks before updateTask.onSettled has been committed, OR an
 * interaction with TaskBoard's localColumns useEffect resync.
 */
describe("useReorderTasks — cross-group reorder", () => {
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

  it("cross-group: dropping a task between two destination-column tasks yields correct order after regroup", async () => {
    const initialTasks = [
      makeTask("c1", 0, { priority: 1 }),
      makeTask("c2", 1, { priority: 1 }), // will be moved into High
      makeTask("h1", 2, { priority: 2 }),
      makeTask("h2", 3, { priority: 2 }),
      makeTask("h3", 4, { priority: 2 }),
    ];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Destination column post-drag order (as TaskBoard.handleDragEnd would compute):
    // user dragged c2 between h1 and h2 → orderedIds = ["h1", "c2", "h2", "h3"]
    const orderedIds = ["h1", "c2", "h2", "h3"];
    const pairs = computeReorderPairs(orderedIds, initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"]);
      expect(cached).toBeDefined();
    });

    const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"])!;

    // Simulate the concurrent updateTask optimistic update: c2.priority := 2
    const withUpdatedPriority = cached.map((t) =>
      t.id === "c2" ? { ...t, priority: 2 } : t,
    );

    // Regroup by priority, sort each group by day_order asc (mirrors useTaskViewData)
    const high = withUpdatedPriority
      .filter((t) => t.priority === 2)
      .sort((a, b) => (a.day_order ?? 0) - (b.day_order ?? 0));
    const highIds = high.map((t) => t.id);

    // The user expects c2 between h1 and h2
    expect(highIds).toEqual(["h1", "c2", "h2", "h3"]);

    // Critical group must keep only c1
    const critical = withUpdatedPriority.filter((t) => t.priority === 1);
    expect(critical.map((t) => t.id)).toEqual(["c1"]);
  });

  it("cross-group: dropping a task at the END of the destination column also preserves order", async () => {
    const initialTasks = [
      makeTask("c1", 0, { priority: 1 }),
      makeTask("c2", 1, { priority: 1 }), // will be moved to end of High
      makeTask("h1", 2, { priority: 2 }),
      makeTask("h2", 3, { priority: 2 }),
    ];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // c2 dropped at end of High: orderedIds = ["h1", "h2", "c2"]
    const orderedIds = ["h1", "h2", "c2"];
    const pairs = computeReorderPairs(orderedIds, initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      expect(
        queryClient.getQueryData<Partial<Task>[]>(["tasks"]),
      ).toBeDefined();
    });

    const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"])!;
    const withUpdated = cached.map((t) =>
      t.id === "c2" ? { ...t, priority: 2 } : t,
    );
    const high = withUpdated
      .filter((t) => t.priority === 2)
      .sort((a, b) => (a.day_order ?? 0) - (b.day_order ?? 0));
    expect(high.map((t) => t.id)).toEqual(["h1", "h2", "c2"]);
  });

  it("cross-group: dropping a task at the START of the destination column preserves order", async () => {
    const initialTasks = [
      makeTask("c1", 0, { priority: 1 }),
      makeTask("c2", 1, { priority: 1 }), // will be moved to start of High
      makeTask("h1", 2, { priority: 2 }),
      makeTask("h2", 3, { priority: 2 }),
    ];
    queryClient.setQueryData(["tasks"], initialTasks);

    const { result } = renderHook(() => useReorderTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // c2 dropped at start of High: orderedIds = ["c2", "h1", "h2"]
    const orderedIds = ["c2", "h1", "h2"];
    const pairs = computeReorderPairs(orderedIds, initialTasks as Task[]);
    result.current.mutate(pairs);

    await waitFor(() => {
      expect(
        queryClient.getQueryData<Partial<Task>[]>(["tasks"]),
      ).toBeDefined();
    });

    const cached = queryClient.getQueryData<Partial<Task>[]>(["tasks"])!;
    const withUpdated = cached.map((t) =>
      t.id === "c2" ? { ...t, priority: 2 } : t,
    );
    const high = withUpdated
      .filter((t) => t.priority === 2)
      .sort((a, b) => (a.day_order ?? 0) - (b.day_order ?? 0));
    expect(high.map((t) => t.id)).toEqual(["c2", "h1", "h2"]);
  });
});
