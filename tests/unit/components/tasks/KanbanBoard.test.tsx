import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { useJsLoaded } from "@/lib/hooks/use-js-loaded";
import {
  useUpdateTask,
  useToggleTask,
  useReorderTasks,
  useDeleteTask,
} from "@/lib/hooks/useTaskMutations";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { ProcessedTasks } from "@/lib/hooks/useTaskViewData";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useProject, useProjects } from "@/lib/hooks/useProjects";

vi.mock("@/lib/hooks/use-js-loaded", () => ({
  useJsLoaded: vi.fn(),
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: vi.fn(),
  useToggleTask: vi.fn(),
  useReorderTasks: vi.fn(),
  useDeleteTask: vi.fn(),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProject: vi.fn(),
  useProjects: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({
    start: vi.fn(),
  }),
}));

// Mock dnd-kit components that are used inside kanban.tsx
vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<Record<string, unknown>>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    PointerSensor: vi.fn(),
    useDroppable: () => ({ setNodeRef: vi.fn() }),
  };
});

describe("IntegratedTaskKanbanBoard", () => {
  const mockProcessedTasks: ProcessedTasks = {
    active: [
      {
        id: "1",
        content: "Active Task",
        priority: 4,
        is_completed: false,
        user_id: "u1",
        project_id: null,
        parent_id: null,
        description: null,
        due_date: null,
        do_date: null,
        is_evening: false,
        day_order: 0,
        recurrence: null,
        google_event_id: null,
        google_etag: null,
        completed_at: null,
        created_at: "",
        updated_at: "",
      },
    ],
    evening: [],
    completed: [],
    groups: [
      {
        title: "Today",
        tasks: [
          {
            id: "2",
            content: "Today Task",
            priority: 1,
            is_completed: false,
            user_id: "u1",
            project_id: null,
            parent_id: null,
            description: null,
            due_date: null,
            do_date: null,
            is_evening: false,
            day_order: 1,
            recurrence: null,
            google_event_id: null,
            google_etag: null,
            completed_at: null,
            created_at: "",
            updated_at: "",
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useJsLoaded).mockReturnValue(true);
    vi.mocked(useMediaQuery).mockReturnValue(true);
    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useUpdateTask>);
    vi.mocked(useToggleTask).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useToggleTask>);
    vi.mocked(useReorderTasks).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useReorderTasks>);
    vi.mocked(useDeleteTask).mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteTask>);
    vi.mocked(useProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);
    vi.mocked(useProject).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useProject>);
  });

  it("renders columns and tasks correctly", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          processedTasks={mockProcessedTasks}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    // Check for column title
    // "Today" is a group title. We have "Today Task" and "Today" (column).
    const todayElements = screen.getAllByText(/today/i);
    expect(todayElements.length).toBeGreaterThanOrEqual(1);

    // Check for task content
    expect(screen.getByText("Today Task")).toBeInTheDocument();

    // Verify presence of accessibility instructions (Screen Reader)
    expect(
      screen.getByText(/to pick up a draggable item/i),
    ).toBeInTheDocument();
  });

  it("renders empty state placeholder when a column is empty", () => {
    const emptyTasks: ProcessedTasks = {
      active: [],
      evening: [],
      completed: [],
      groups: [{ title: "Empty Column", tasks: [] }],
    };

    render(
      <TooltipProvider>
        <TaskBoard
          processedTasks={emptyTasks}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Ma (Void)")).toBeInTheDocument();
  });

  it("respects Zen-Modernism: no headers in grid mode (verify board mode specific features)", () => {
    render(
      <TooltipProvider>
        <TaskBoard
          processedTasks={mockProcessedTasks}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    // The board should show task counts in headers
    expect(screen.getByText("1")).toBeInTheDocument(); // Task count in column
  });

  it("calls onSelect when a task card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <TaskBoard
          processedTasks={mockProcessedTasks}
          onSelect={onSelect}
          projectsMap={new Map()}
          isDesktop={true}
          triggerHaptic={vi.fn()}
          setActiveTaskId={vi.fn()}
        />
      </TooltipProvider>,
    );

    const task = screen.getByText("Today Task");
    task.click();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Today Task" }),
    );
  });
});
