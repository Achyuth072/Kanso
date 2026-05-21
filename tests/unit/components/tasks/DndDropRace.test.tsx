/**
 * Regression test for residual DnD race condition.
 *
 * Symptom: On drop, surrounding tasks briefly push back to their original
 * positions; the drag overlay animates to the original position then snaps to
 * the new position.
 *
 * Root-cause invariant we are protecting:
 *   At the moment React renders after `handleDragEnd` (i.e. after dnd-kit's
 *   internal DragEnd dispatch is batched with our setActiveId(null) /
 *   setLockLocal(true) updates), the props passed to <TaskListView> MUST
 *   reflect the NEW (post-drag) order of tasks. They must never fall through
 *   to `processedTasks.active`, which can lag behind the optimistic cache
 *   update inside React Query's onMutate.
 *
 * The test simulates a same-section reorder by invoking the captured
 * `onDragStart`, `onDragOver`, `onDragEnd` props of `DndContext`. After
 * dragEnd, it asserts that the latest `activeTasks` prop captured by the
 * mocked TaskListView reflects the new order — proving that local state
 * (localActive) is still the source of truth, not stale processedTasks.
 */

import type { ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useUiStore } from "@/lib/store/uiStore";
import {
  useReorderTasks,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
} from "@/lib/hooks/useTaskMutations";
import type { Task } from "@/lib/types/task";

// --- Capture DndContext props so the test can invoke handlers directly ---
type DndHandlers = {
  onDragStart?: (event: { active: { id: string } }) => void;
  onDragOver?: (event: {
    active: {
      id: string;
      data: { current?: { sortable?: { containerId?: string } } };
    };
    over: {
      id: string;
      data: { current?: { sortable?: { containerId?: string } } };
    } | null;
  }) => void;
  onDragEnd?: (event: {
    active: { id: string };
    over: { id: string } | null;
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

// --- Capture TaskListView props on every render ---
const taskListViewRenders: Array<{ activeTasks: Task[] }> = [];

vi.mock("@/components/tasks/TaskListView", () => ({
  TaskListView: (props: { activeTasks: Task[] }) => {
    taskListViewRenders.push({ activeTasks: props.activeTasks });
    return <div data-testid="task-list-view" />;
  },
}));

vi.mock("@/components/tasks/TaskMasonryGrid", () => ({
  TaskMasonryGrid: () => <div data-testid="task-grid-view" />,
}));

vi.mock("@/components/tasks/TaskBoard", () => ({
  TaskBoard: () => <div data-testid="task-board-view" />,
}));

vi.mock("@/components/tasks/TaskGhost", () => ({
  TaskGhost: () => <div data-testid="task-ghost" />,
}));

vi.mock("@/components/tasks/TaskSheet", () => ({
  default: () => null,
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useReorderTasks: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  useToggleTask: vi.fn(),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ start: vi.fn() }),
}));

// 5 active tasks in non-evening section, no groups
const makeTasks = (): Task[] =>
  Array.from({ length: 5 }, (_, index) => ({
    id: `task-${index}`,
    user_id: "guest",
    content: `Task ${index}`,
    description: null,
    is_completed: false,
    completed_at: null,
    priority: 4,
    project_id: null,
    day_order: index,
    created_at: "2026-05-13T00:00:00.000Z",
    updated_at: "2026-05-13T00:00:00.000Z",
    due_date: null,
    do_date: null,
    is_evening: false,
    parent_id: null,
    recurrence: null,
    google_event_id: null,
    google_etag: null,
  }));

describe("TaskList drop race condition (residual snap-back)", () => {
  beforeEach(() => {
    captured.handlers = {};
    taskListViewRenders.length = 0;

    vi.mocked(useTasks).mockReturnValue({
      data: makeTasks(),
      isLoading: false,
    } as ReturnType<typeof useTasks>);

    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);

    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);

    vi.mocked(useDeleteTask).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteTask>);

    vi.mocked(useToggleTask).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useToggleTask>);

    vi.mocked(useUiStore).mockImplementation((selector) =>
      selector({
        isProjectsOpen: true,
        toggleProjectsOpen: vi.fn(),
        sortBy: "custom",
        groupBy: "none",
        viewMode: "list",
        setSortBy: vi.fn(),
        setGroupBy: vi.fn(),
        setViewMode: vi.fn(),
        timeFormat: "system",
        setTimeFormat: vi.fn(),
        hapticsEnabled: true,
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

  it("preserves local order through drag-over → drag-end (no fallback to processedTasks)", () => {
    render(<TaskList projectId="all" sortBy="custom" />);

    // Initial render: TaskListView received the source-of-truth order
    const initial = taskListViewRenders.at(-1);
    expect(initial?.activeTasks.map((t) => t.id)).toEqual([
      "task-0",
      "task-1",
      "task-2",
      "task-3",
      "task-4",
    ]);

    // Simulate: start dragging task-0
    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "task-0" } });
    });

    // Simulate dragging over task-3 (move task-0 down 3 positions)
    act(() => {
      captured.handlers.onDragOver?.({
        active: {
          id: "task-0",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
        over: {
          id: "task-3",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
      });
    });

    // After onDragOver: TaskListView should see NEW local order
    const afterDragOver = taskListViewRenders.at(-1);
    expect(afterDragOver?.activeTasks.map((t) => t.id)).toEqual([
      "task-1",
      "task-2",
      "task-3",
      "task-0",
      "task-4",
    ]);

    // Mark the boundary: any revert that happens AFTER this point is a bug
    // (the user has visually committed to the new order via the drag).
    const indexAfterDragOver = taskListViewRenders.length - 1;

    // Simulate drop
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "task-0" },
        over: { id: "task-3" },
      });
    });

    // CRITICAL ASSERTION 1:
    // After dragEnd, the latest render's activeTasks MUST still reflect the
    // new order.
    const afterDragEnd = taskListViewRenders.at(-1);
    expect(afterDragEnd?.activeTasks.map((t) => t.id)).toEqual([
      "task-1",
      "task-2",
      "task-3",
      "task-0",
      "task-4",
    ]);

    // CRITICAL ASSERTION 2:
    // At NO render after the drag-over (i.e. once the user has visually
    // committed to the new order during the drag) should activeTasks revert
    // to the original [task-0..task-4] order. Such a revert would manifest
    // visually as items snapping back to original positions before settling
    // at the new position — the residual snap-back bug.
    const rendersAfterUserCommitted = taskListViewRenders.slice(
      indexAfterDragOver + 1,
    );
    const summary = taskListViewRenders.map((r, i) => ({
      renderIndex: i,
      ids: r.activeTasks.map((t) => t.id),
    }));
    const anyRevertedRender = rendersAfterUserCommitted.find(
      (r) => r.activeTasks.length === 5 && r.activeTasks[0].id === "task-0",
    );
    expect(
      anyRevertedRender,
      `Render history: ${JSON.stringify(summary, null, 2)}`,
    ).toBeUndefined();
  });

  it("locks local state synchronously on drop so no render exposes stale processedTasks", () => {
    render(<TaskList projectId="all" sortBy="custom" />);

    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "task-0" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: {
          id: "task-0",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
        over: {
          id: "task-2",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
      });
    });

    // Snapshot the count of renders BEFORE drop
    const rendersBeforeDrop = taskListViewRenders.length;

    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "task-0" },
        over: { id: "task-2" },
      });
    });

    // Every render AFTER the drop must show the NEW order (task-0 not at
    // position 0). If lockLocal isn't set in time, one of these renders
    // would have task-0 back at index 0 (the processedTasks fallback).
    const rendersAfterDrop = taskListViewRenders.slice(rendersBeforeDrop);
    expect(rendersAfterDrop.length).toBeGreaterThan(0);

    for (const r of rendersAfterDrop) {
      expect(r.activeTasks[0].id).not.toBe("task-0");
    }
  });

  it("invokes reorderMutation.mutate with slot-value-swap pairs in the correct new order", () => {
    // This is the most important contract: the pairs passed to
    // reorderMutation.mutate MUST reflect the new order the user dragged to,
    // AND carry the correct day_order values from slot-value-swap.
    //
    // The tasks have day_order = index (task-0 → 0, task-1 → 1, ...).
    // After dragging task-0 over task-3, new order = [task-1, task-2, task-3, task-0, task-4].
    // Slot-value-swap assigns:
    //   task-1 → slot 0 (day_order 0)
    //   task-2 → slot 1 (day_order 1)
    //   task-3 → slot 2 (day_order 2)
    //   task-0 → slot 3 (day_order 3)
    //   task-4 → slot 4 (day_order 4)

    const mutateMock = vi.fn();
    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useReorderTasks>);

    render(<TaskList projectId="all" sortBy="custom" />);

    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "task-0" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: {
          id: "task-0",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
        over: {
          id: "task-3",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
      });
    });
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "task-0" },
        over: { id: "task-3" },
      });
    });

    expect(mutateMock).toHaveBeenCalledOnce();
    const [pairs] = mutateMock.mock.calls[0];
    // Verify the pairs carry the correct new order (IDs) and slot day_order values
    expect(pairs).toEqual([
      { id: "task-1", day_order: 0 },
      { id: "task-2", day_order: 1 },
      { id: "task-3", day_order: 2 },
      { id: "task-0", day_order: 3 },
      { id: "task-4", day_order: 4 },
    ]);
  });

  it("survives a parent-driven processedTasks reference change during the drop batch", () => {
    // This simulates the real-world scenario where setSortBy('custom') in
    // handleDragEnd causes HomeClient to re-render TaskList with a new
    // sortBy prop, which changes processedTasks's reference but NOT its
    // content (since useTasks data hasn't been updated by onMutate yet).
    //
    // If the displayTasks fallback to processedTasks.active happens for
    // even one render here, it manifests as the residual snap-back.

    const { rerender } = render(<TaskList projectId="all" sortBy="custom" />);

    act(() => {
      captured.handlers.onDragStart?.({ active: { id: "task-0" } });
    });
    act(() => {
      captured.handlers.onDragOver?.({
        active: {
          id: "task-0",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
        over: {
          id: "task-3",
          data: { current: { sortable: { containerId: "active-section" } } },
        },
      });
    });

    const indexAfterDragOver = taskListViewRenders.length - 1;

    // Drop AND simultaneously trigger a parent re-render (mimics
    // setSortBy/Zustand-driven render in real usage). Both happen in the
    // same React batch via act.
    act(() => {
      captured.handlers.onDragEnd?.({
        active: { id: "task-0" },
        over: { id: "task-3" },
      });
      // Parent prop change in the same batch
      rerender(<TaskList projectId="all" sortBy="custom" />);
    });

    const rendersAfterCommit = taskListViewRenders.slice(
      indexAfterDragOver + 1,
    );
    const summary = taskListViewRenders.map((r, i) => ({
      renderIndex: i,
      ids: r.activeTasks.map((t) => t.id),
    }));

    // No render after the user committed (post-dragOver) should have task-0
    // at index 0. If any does, the lockLocal/local-state pattern is leaking.
    for (const r of rendersAfterCommit) {
      expect(
        r.activeTasks[0].id,
        `Render history: ${JSON.stringify(summary, null, 2)}`,
      ).not.toBe("task-0");
    }
  });
});
