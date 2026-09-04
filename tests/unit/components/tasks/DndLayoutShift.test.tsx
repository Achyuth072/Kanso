import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MeasuringStrategy } from "@dnd-kit/core";
import TaskList from "@/components/tasks/TaskList";

// TaskList calls useQueryClient(); provide a bare client (data hooks are mocked
// so no real queries run).
const testQueryClient = new QueryClient();
const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
);
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useUiStore } from "@/lib/store/uiStore";
import type { Task } from "@/lib/types/task";

const dndKitMock = vi.hoisted(() => ({
  latestDndContextProps: null as {
    autoScroll?: { canScroll?: (element: Element) => boolean };
    measuring?: { droppable?: { strategy?: number } };
  } | null,
}));

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");

  return {
    ...actual,
    DndContext: ({
      children,
      ...props
    }: {
      children: ReactNode;
      [key: string]: unknown;
    }) => {
      dndKitMock.latestDndContextProps = props;
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

vi.mock("@/components/tasks/TaskListView", () => ({
  TaskListView: () => <div data-testid="task-list-view" />,
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
  useReorderTasks: () => ({ isPending: false, mutate: vi.fn() }),
  useUpdateTask: () => ({ isPending: false, mutate: vi.fn() }),
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useToggleTask: () => ({ mutate: vi.fn() }),
  useDuplicateTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn(),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn(), isAddTaskOpen: false }),
}));

vi.mock("@/components/habits/HabitActionsProvider", () => ({
  useHabitActions: () => ({ openAddHabit: vi.fn(), isHabitSheetOpen: false }),
}));

vi.mock("@/components/ProjectActionsProvider", () => ({
  useProjectActions: () => ({
    openCreateProject: vi.fn(),
    isCreateProjectOpen: false,
  }),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: () => ({
    openCreateEvent: vi.fn(),
    isCreateEventOpen: false,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ start: vi.fn() }),
}));

const tasks: Task[] = Array.from({ length: 24 }, (_, index) => ({
  id: `task-${index}`,
  user_id: "guest",
  content: `Task ${index}`,
  description: null,
  is_completed: false,
  completed_at: null,
  priority: 4,
  project_id: null,
  day_order: index,
  created_at: "2026-05-06T00:00:00.000Z",
  updated_at: "2026-05-06T00:00:00.000Z",
  due_date: null,
  do_date: null,
  is_evening: false,
  parent_id: null,
  recurrence: null,
  recurring_series_id: null,
  google_event_id: null,
  google_etag: null,
}));

describe("TaskList DnD layout shift protection", () => {
  beforeEach(() => {
    dndKitMock.latestDndContextProps = null;
    vi.mocked(useTasks).mockReturnValue({
      data: tasks,
      isLoading: false,
    } as ReturnType<typeof useTasks>);
    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);
    vi.mocked(useUiStore).mockImplementation((selector) =>
      selector({
        isProjectsOpen: true,
        toggleProjectsOpen: vi.fn(),
        sortBy: "date",
        groupBy: "none",
        viewMode: "list",
        setSortBy: vi.fn(),
        setGroupBy: vi.fn(),
        setViewMode: vi.fn(),
        customSortEnteredViaDrag: false,
        setCustomSortEnteredViaDrag: vi.fn(),
        habitViewMode: "grid",
        setHabitViewMode: vi.fn(),
        statsPeriod: "30d",
        setStatsPeriod: vi.fn(),
        timeFormat: "system",
        setTimeFormat: vi.fn(),
        hapticsEnabled: true,
        setHapticsEnabled: vi.fn(),
        notificationsEnabled: false,
        setNotificationsEnabled: vi.fn(),
        backupReminderEnabled: true,
        setBackupReminderEnabled: vi.fn(),
        backupReminderFrequencyDays: 7,
        setBackupReminderFrequencyDays: vi.fn(),
        autoLockEnabled: false,
        setAutoLockEnabled: vi.fn(),
        autoLockMinutes: 60,
        setAutoLockMinutes: vi.fn(),
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
        hasChangelogUpdate: false,
        setHasChangelogUpdate: vi.fn(),
        goals: {
          dailyFocusHours: null,
          weeklyFocusHours: null,
          dailyTasksCompleted: null,
          weeklyTasksCompleted: null,
        },
        setGoals: vi.fn(),
        lastUndoAction: null,
        setLastUndoAction: vi.fn(),
        triggerLastUndoAction: vi.fn(),
        yankedTaskId: null,
        setYankedTaskId: vi.fn(),
      }),
    );
  });

  it("confines desktop list auto-scroll to the dedicated list scroller", () => {
    const { container } = render(<TaskList projectId="all" />, {
      wrapper: Providers,
    });
    const props = dndKitMock.latestDndContextProps;
    const canScroll = props?.autoScroll?.canScroll;

    expect(canScroll).toEqual(expect.any(Function));
    if (!canScroll) {
      throw new Error("TaskList DndContext autoScroll.canScroll was not set");
    }

    const listScroller = container.querySelector(
      "[data-task-list-scroll-container='true']",
    );
    const pageShell = document.createElement("div");
    const splitPane = document.createElement("div");
    const blockedByClass = document.createElement("div");
    blockedByClass.className = "no-dnd-scroll";

    expect(listScroller).not.toBeNull();
    expect(canScroll(listScroller as Element)).toBe(true);
    expect(canScroll(pageShell)).toBe(false);
    expect(canScroll(splitPane)).toBe(false);
    expect(canScroll(blockedByClass)).toBe(false);
    expect(canScroll(document.body)).toBe(false);
    expect(canScroll(document.documentElement)).toBe(false);
  });

  it("uses WhileDragging measuring to avoid re-measuring on every drag-over registry mutation", () => {
    render(<TaskList projectId="all" />, { wrapper: Providers });

    expect(
      dndKitMock.latestDndContextProps?.measuring?.droppable?.strategy,
    ).toBe(MeasuringStrategy.WhileDragging);
  });
});
