/**
 * TDD regression test for cross-group snap-back in TaskBoard.
 *
 * Root cause (identified via debug session dnd-cross-group-snap-back-context.md):
 *
 *   When a cross-column drop fires two mutations:
 *     1. updateMutation  — updates the task's group-property (e.g. priority: 1)
 *     2. reorderMutation — updates day_order for the destination column
 *
 *   reorderMutation settles first → mutation-level onSettled calls
 *   invalidateQueries(["tasks"]) → a background refetch starts.
 *
 *   If this refetch completes BEFORE updateMutation has committed to the server,
 *   the server returns the task with its OLD property value (e.g. priority: 2).
 *   React Query overwrites the optimistic cache with the stale server data.
 *   The parent re-renders TaskBoard with stale processedTasks → boardColumns
 *   has the task back in the old column.
 *
 *   When updateMutation finally settles, tryReleaseLock fires → setLockLocal(false)
 *   → displayColumns switches to boardColumns (STALE) → task appears in wrong
 *   column for a frame → SNAP-BACK.
 *
 * The fix: defer setLockLocal(false) until boardColumns actually reflects the
 * expected destination column (i.e. the task appears in the destination column
 * in boardColumns). This is tracked via a pendingLockRelease ref + a useEffect
 * that watches boardColumns and releases only when the condition is met.
 *
 * Test structure:
 *   1. Render TaskBoard with priority groups: High=[t1,t2], Critical=[t3]
 *   2. Drag t1 from High to Critical (DragStart → DragOver → DragEnd)
 *   3. Simulate stale-refetch scenario: re-render with stale processedTasks
 *      (t1 still in High, not Critical) — mimics the cache overwrite.
 *   4. Call reorderMutation.onSettled (pending 2→1, lock should stay)
 *   5. Call updateMutation.onSettled  (pending 1→0, lock should NOT release yet
 *      because boardColumns is stale)
 *   6. Assert t1 is STILL in Critical (lockLocal held via deferred release)
 *   7. Re-render with correct processedTasks (t1 in Critical)
 *   8. Assert t1 is now shown in Critical (deferred release fired, lock released)
 *
 * Steps 6 & 8 both FAIL without the fix; PASS with the fix.
 */

import type { ReactNode } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { useReorderTasks, useUpdateTask } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task, Project } from "@/lib/types/task";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";

// --- Capture DndContext handlers ---
type MockOver = {
  id: string;
  data?: { current?: { sortable?: { index?: number; containerId?: string } } };
};
type DndHandlers = {
  onDragStart?: (event: { active: { id: string } }) => void;
  onDragOver?: (event: {
    active: { id: string };
    over: MockOver | null;
  }) => void;
  onDragEnd?: (event: {
    active: { id: string };
    over: MockOver | null;
  }) => void;
};
const captured: { handlers: DndHandlers } = { handlers: {} };

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
    }: {
      children: ReactNode;
      onDragStart?: DndHandlers["onDragStart"];
      onDragOver?: DndHandlers["onDragOver"];
      onDragEnd?: DndHandlers["onDragEnd"];
    }) => {
      captured.handlers.onDragStart = onDragStart;
      captured.handlers.onDragOver = onDragOver;
      captured.handlers.onDragEnd = onDragEnd;
      return <div data-testid="dnd-context">{children}</div>;
    },
    DragOverlay: ({ children }: { children: ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useDroppable: () => ({ setNodeRef: vi.fn() }),
    useSensor: vi.fn((sensor, options) => ({ sensor, options })),
    useSensors: vi.fn((...sensors) => sensors),
  };
});

vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/sortable")>(
      "@dnd-kit/sortable",
    );
  return {
    ...actual,
    SortableContext: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    sortableKeyboardCoordinates: vi.fn(),
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
      isOver: false,
      active: null,
      over: null,
    }),
  };
});

// Mock SortableBoardTaskCard to render a simple element carrying the task id
vi.mock("@/components/tasks/SortableBoardTaskCard", () => ({
  SortableBoardTaskCard: ({ task }: { task: Task }) => (
    <div data-testid={`card-${task.id}`} />
  ),
}));

vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));

// KanbanBoardProvider just renders children
vi.mock("@/components/kanban", () => ({
  KanbanBoardProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: vi.fn(),
  useUpdateTask: vi.fn(),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// --- Task fixtures ---
const makeTask = (id: string, priority: number, dayOrder: number): Task => ({
  id,
  user_id: "guest",
  content: `Task ${id}`,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: priority as Task["priority"],
  project_id: null,
  day_order: dayOrder,
  created_at: "2026-05-14T00:00:00.000Z",
  updated_at: "2026-05-14T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  google_event_id: null,
  google_etag: null,
});

// t1, t2 in "High" (priority=2); t3 in "Critical" (priority=1)
const t1 = makeTask("t1", 2, 2);
const t2 = makeTask("t2", 2, 3);
const t3 = makeTask("t3", 1, 0);

// processedTasks with t1 STILL in High (stale / pre-fix server data)
const staleProcessedTasks: ProcessedTasks = {
  active: [t1, t2, t3],
  evening: [],
  completed: [],
  groups: [
    { title: "Critical", tasks: [t3] },
    { title: "High", tasks: [t1, t2] },
  ],
};

// processedTasks with t1 MOVED to Critical (correct post-mutation server data)
const correctProcessedTasks: ProcessedTasks = {
  active: [{ ...t1, priority: 1 }, t2, t3],
  evening: [],
  completed: [],
  groups: [
    { title: "Critical", tasks: [{ ...t1, priority: 1 }, t3] },
    { title: "High", tasks: [t2] },
  ],
};

const defaultProps = {
  projectsMap: new Map<string, Project>(),
  isDesktop: true,
  triggerHaptic: vi.fn(),
  startTimer: vi.fn(),
};

describe("TaskBoard — cross-group snap-back regression", () => {
  let reorderMutateMock: ReturnType<typeof vi.fn>;
  let updateMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captured.handlers = {};
    reorderMutateMock = vi.fn();
    updateMutateMock = vi.fn();

    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: reorderMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);

    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: updateMutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);

    vi.mocked(useUiStore).mockImplementation((selector) =>
      selector({
        sortBy: "custom",
        groupBy: "none",
        viewMode: "board",
        setSortBy: vi.fn(),
        setGroupBy: vi.fn(),
        setViewMode: vi.fn(),
        isProjectsOpen: true,
        toggleProjectsOpen: vi.fn(),
        timeFormat: "system",
        setTimeFormat: vi.fn(),
        hapticsEnabled: false,
        setHapticsEnabled: vi.fn(),
        notificationsEnabled: false,
        setNotificationsEnabled: vi.fn(),
        isShortcutsHelpOpen: false,
        setShortcutsHelpOpen: vi.fn(),
        isPipActive: false,
        setIsPipActive: vi.fn(),
        isArchivedProjectsOpen: false,
        setArchivedProjectsOpen: vi.fn(),
        selectedTaskId: null,
        setSelectedTaskId: vi.fn(),
        editingTaskId: null,
        setEditingTaskId: vi.fn(),
        isDesktop: true,
        setIsDesktop: vi.fn(),
        lastSeenVersion: "",
        setLastSeenVersion: vi.fn(),
        lastDismissedVersion: "",
        setLastDismissedVersion: vi.fn(),
        isChangelogOpen: false,
        setChangelogOpen: vi.fn(),
        _hasHydrated: true,
        setHasHydrated: vi.fn(),
        isFullscreen: false,
        setIsFullscreen: vi.fn(),
        isSynced: false,
        setIsSynced: vi.fn(),
      }),
    );
  });

  /**
   * Helper: check which column task `id` is rendered in.
   * Returns "Critical" | "High" | null.
   */
  function getTaskColumn(taskId: string): string | null {
    const card = document.querySelector(`[data-testid="card-${taskId}"]`);
    if (!card) return null;
    const section = card.closest("section");
    if (!section) return null;
    const heading = section.querySelector("h3");
    // Read only the first text node to avoid including the task-count <span>
    return (
      (heading?.childNodes[0] as Text | undefined)?.textContent?.trim() ?? null
    );
  }

  it("holds the display lock until boardColumns reflects the destination column (deferred release)", () => {
    const { rerender } = render(
      <TaskBoard processedTasks={staleProcessedTasks} {...defaultProps} />,
    );

    // Initial: t1 must be in High
    expect(getTaskColumn("t1")).toBe("High");

    // --- Drag t1 from High to Critical ---
    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "t1" } });
    });
    act(() => {
      // Drag over the Critical column (using column title as over.id)
      captured.handlers.onDragOver?.({
        active: { id: "t1" },
        over: { id: "Critical" },
      });
    });

    // After dragOver: t1 must be in Critical in local state
    expect(getTaskColumn("t1")).toBe("Critical");

    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "t1" },
        over: { id: "t3" },
      });
    });

    // Capture the onSettled callbacks from the two mutation calls
    // updateMutation fires for the priority change (hasChanged=true)
    // reorderMutation fires for the day_order update
    expect(updateMutateMock).toHaveBeenCalledOnce();
    expect(reorderMutateMock).toHaveBeenCalledOnce();

    const updateOnSettled: (() => void) | undefined =
      updateMutateMock.mock.calls[0]?.[1]?.onSettled;
    const reorderOnSettled: (() => void) | undefined =
      reorderMutateMock.mock.calls[0]?.[1]?.onSettled;

    expect(updateOnSettled).toBeDefined();
    expect(reorderOnSettled).toBeDefined();

    // --- Simulate stale refetch: re-render with stale processedTasks ---
    // This mimics the race where reorderMutation.onSettled triggers
    // invalidateQueries → a refetch returns OLD server data (t1 priority=2,
    // still in High). The parent component re-renders TaskBoard with this
    // stale processedTasks prop, overwriting boardColumns.
    act(() => {
      rerender(
        <TaskBoard processedTasks={staleProcessedTasks} {...defaultProps} />,
      );
    });

    // At this point: lockLocal=true (still dragging), display shows localColumns
    // t1 must still appear in Critical regardless of the stale prop
    expect(getTaskColumn("t1")).toBe("Critical");

    // --- reorderMutation settles first (pendingCount 2 → 1) ---
    act(() => {
      reorderOnSettled?.();
    });

    // Lock must still be held (pendingCount=1 — updateMutation still pending)
    expect(getTaskColumn("t1")).toBe("Critical");

    // --- updateMutation settles (pendingCount 1 → 0) ---
    // With the fix (deferred release): lock does NOT release yet because
    // boardColumns (from stale processedTasks) still has t1 in High.
    // Without the fix: lock releases immediately → displayColumns = boardColumns
    // (stale) → t1 appears in High → snap-back.
    act(() => {
      updateOnSettled?.();
    });

    // CRITICAL ASSERTION 1: t1 must NOT snap back to High.
    // Fails without the deferred-release fix.
    expect(getTaskColumn("t1")).toBe("Critical");
    expect(getTaskColumn("t1")).not.toBe("High");

    // --- Parent re-renders with CORRECT processedTasks (final refetch done) ---
    // This simulates the updateMutation's own invalidateQueries refetch completing
    // and returning the correct server data (t1 priority=1, in Critical).
    // The deferred release useEffect should now fire and release the lock.
    act(() => {
      rerender(
        <TaskBoard processedTasks={correctProcessedTasks} {...defaultProps} />,
      );
    });

    // CRITICAL ASSERTION 2: t1 must now be in Critical (lock released correctly,
    // boardColumns reflects correct state).
    expect(getTaskColumn("t1")).toBe("Critical");
    expect(getTaskColumn("t1")).not.toBe("High");
  });

  it("releases lock immediately for same-column reorder (no updateMutation)", () => {
    render(
      <TaskBoard processedTasks={staleProcessedTasks} {...defaultProps} />,
    );

    // Drag t1 within the High column (t1 → t2 swap)
    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "t1" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: { id: "t1" },
        over: { id: "t2" },
      });
    });
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "t1" },
        over: { id: "t2" },
      });
    });

    // For same-column: hasChanged=false → updateMutation must NOT fire
    // Only reorderMutation fires
    expect(updateMutateMock).not.toHaveBeenCalled();
    expect(reorderMutateMock).toHaveBeenCalledOnce();

    const reorderOnSettled: (() => void) | undefined =
      reorderMutateMock.mock.calls[0]?.[1]?.onSettled;
    expect(reorderOnSettled).toBeDefined();

    // When only reorderMutation settles, lock releases immediately
    act(() => {
      reorderOnSettled?.();
    });

    // After same-column reorder, t1 and t2 should both still be in High
    expect(getTaskColumn("t1")).toBe("High");
    expect(getTaskColumn("t2")).toBe("High");
  });
});
