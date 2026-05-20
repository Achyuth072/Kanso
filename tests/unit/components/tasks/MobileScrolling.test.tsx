import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { TaskMasonryGrid } from "@/components/tasks/TaskMasonryGrid";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskListView } from "@/components/tasks/TaskListView";
import type { ReactNode } from "react";
import type { Task } from "@/lib/types/task";

// Mock DnD Kit Core
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  closestCorners: vi.fn(),
  closestCenter: vi.fn(),
  rectIntersection: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn(),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  MeasuringStrategy: { Always: 0 },
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
  defaultDropAnimationSideEffects: vi.fn(() => ({})),
}));

// Mock DnD Kit Sortable
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  verticalListSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: vi.fn((array) => array),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

// Mock DnD Kit Utilities (used by SortableTaskItem)
vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => null),
    },
  },
}));

// Mock useTaskMutations
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useToggleTask: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useUpdateTask: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useReorderTasks: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock useHaptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

// Mock useTimer hook
vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    status: "idle",
  }),
}));

// Mock TaskItem component (use correct alias path)
vi.mock("@/components/tasks/TaskItem", () => ({
  __esModule: true,
  default: () => <div data-testid="task-item" />,
  TaskItem: () => <div data-testid="task-item" />,
}));

vi.mock("@/components/tasks/SortableListTaskCard", () => ({
  __esModule: true,
  default: () => <div data-testid="sortable-task-item" />,
}));

vi.mock("@/components/tasks/SortableBoardTaskCard", () => ({
  __esModule: true,
  SortableBoardTaskCard: () => <div data-testid="sortable-task-item" />,
}));

// Mock useUiStore
vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((selector) => {
    const state = {
      sortBy: "custom",
      setSortBy: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock useProjects hook
vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [],
    isLoading: false,
  }),
}));

// Mock useJsLoaded hook
vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: () => true,
}));

describe("Mobile Scrolling Padding", () => {
  const mockTask: Task = {
    id: "1",
    user_id: "guest",
    content: "Test Task",
    description: null,
    is_completed: false,
    completed_at: null,
    priority: 4,
    project_id: null,
    day_order: 0,
    created_at: "2026-05-06T00:00:00.000Z",
    updated_at: "2026-05-06T00:00:00.000Z",
    due_date: null,
    do_date: null,
    is_evening: false,
    parent_id: null,
    recurrence: null,
    google_event_id: null,
    google_etag: null,
  };

  const mockProcessedTasks = {
    active: [mockTask],
    evening: [],
    completed: [],
    groups: null,
  };

  it("TaskMasonryGrid should have bottom padding to prevent cutoff on mobile", () => {
    const dummyProps = {
      projectsMap: new Map(),
      isDesktop: false,
      triggerHaptic: vi.fn(),
      startTimer: vi.fn(),
    };

    const { container: _container } = render(
      <TaskMasonryGrid processedTasks={mockProcessedTasks} {...dummyProps} />,
    );

    const gridContainer = screen.getByTestId("task-grid-container");
    expect(gridContainer).not.toBeNull();
    expect(gridContainer?.className).toContain("pb-12");
    expect(gridContainer?.className).toContain("md:pb-8");
  });

  it("TaskBoard should have bottom padding to prevent cutoff on mobile", () => {
    const dummyProps = {
      projectsMap: new Map(),
      isDesktop: false,
      triggerHaptic: vi.fn(),
      startTimer: vi.fn(),
    };

    const { container: _container } = render(
      <TaskBoard processedTasks={mockProcessedTasks} {...dummyProps} />,
    );

    // Find the board container which has pb-12 class
    const boardContainer = screen.getByTestId("task-board-container");
    expect(boardContainer).not.toBeNull();
    expect(boardContainer?.className).toContain("pb-12");
    expect(boardContainer?.className).toContain("md:pb-6");
  });

  it("TaskListView should have bottom padding to prevent cutoff on mobile", () => {
    const dummyProps = {
      projectsMap: new Map(),
      isDesktop: false,
      triggerHaptic: vi.fn(),
      startTimer: vi.fn(),
    };

    const { container: _container } = render(
      <TaskListView
        processedTasks={mockProcessedTasks}
        activeTasks={mockProcessedTasks.active}
        eveningTasks={mockProcessedTasks.evening}
        groupTasks={mockProcessedTasks.groups}
        handleTaskClick={vi.fn()}
        keyboardSelectedId={null}
        {...dummyProps}
      />,
    );

    const listContainer = screen.getByTestId("task-list-container");
    expect(listContainer).not.toBeNull();
    expect(listContainer?.className).toContain("pb-12");
    expect(listContainer?.className).toContain("md:pb-8");
  });
});
