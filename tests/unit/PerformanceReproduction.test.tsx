import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskList from "@/components/tasks/TaskList";
import { useTasks } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useAuth } from "@/components/AuthProvider";
import { useUiStore } from "@/lib/store/uiStore";

// Mock hooks
vi.mock("@/lib/hooks/useTasks", () => ({
  useTasks: vi.fn(),
  useInboxProject: () => ({ data: { id: "inbox" }, isLoading: false }),
}));
vi.mock("@/lib/hooks/useProjects");
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useCreateTask: () => ({ isPending: false }),
  useReorderTasks: () => ({ isPending: false }),
  useUpdateTask: () => ({ isPending: false }),
  useDeleteTask: () => ({ isPending: false }),
  useToggleTask: () => ({ isPending: false }),
}));
vi.mock("@/components/AuthProvider");
vi.mock("@/lib/store/uiStore");
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));
vi.mock("@/components/TaskActionsProvider", () => ({
  useTaskActions: () => ({ openAddTask: vi.fn() }),
}));
vi.mock("@/components/TimerProvider", () => ({
  useTimer: () => ({ start: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("TaskList Performance Gaps", () => {
  const mockTasks = [
    { id: "1", content: "Task 1", priority: 4, day_order: 0 },
    { id: "2", content: "Task 2", priority: 4, day_order: 1 },
  ];

  const mockProjects = [
    { id: "inbox", name: "Inbox", color: "#ccc", is_inbox: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ isGuestMode: true, loading: false });
    (useProjects as any).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    });
    (useUiStore as any).mockReturnValue("list"); // default viewMode
  });

  it("PERF-01: Renders tasks on the first render (no empty flash)", () => {
    // Given: useTasks returns data immediately (cached state)
    (useTasks as any).mockReturnValue({ data: mockTasks, isLoading: false });

    // When: Rendering TaskList
    render(<TaskList />);

    // Then: Task 1 should be in the document immediately
    // If it's empty on first render, this will fail if we don't wait
    const taskElement = screen.queryByText("Task 1");
    expect(taskElement).toBeInTheDocument();
  });
});
