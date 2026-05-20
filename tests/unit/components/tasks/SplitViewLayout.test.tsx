import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SplitViewLayout } from "@/components/tasks/SplitViewLayout";
import type { Task } from "@/lib/types/task";

// Mock dependencies using absolute paths
vi.mock("@/components/tasks/TaskList", () => ({
  default: ({ onTaskSelect }: { onTaskSelect: (task: Task) => void }) => (
    <div data-testid="task-list">
      <button
        onClick={() =>
          onTaskSelect({ id: "task-1", content: "Selected Task" } as Task)
        }
      >
        Select Task 1
      </button>
    </div>
  ),
}));

vi.mock("@/components/tasks/TaskDetailPanel", () => ({
  TaskDetailPanel: ({
    task,
    onClose,
  }: {
    task: Task | null;
    onClose: () => void;
  }) => (
    <div data-testid="task-detail-panel">
      {task ? (
        <>
          <span>{task.content}</span>
          <button onClick={onClose}>Close Detail</button>
        </>
      ) : (
        <span>Empty State</span>
      )}
    </div>
  ),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
  }),
}));

describe("SplitViewLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SV-N-01: Renders with no selected task by default", () => {
    // Given: Default props
    // When: Rendering the layout
    render(<SplitViewLayout />);

    // Then: Detail panel should show empty state
    expect(screen.getByText("Empty State")).toBeInTheDocument();
  });

  it("SV-N-02: Updates detail panel when a task is selected", () => {
    // Given: Layout is rendered
    render(<SplitViewLayout />);

    // When: Selecting a task from the list
    const selectBtn = screen.getByText("Select Task 1");
    fireEvent.click(selectBtn);

    // Then: Detail panel should show the selected task
    expect(screen.getByText("Selected Task")).toBeInTheDocument();
    expect(mockHapticTrigger).toHaveBeenCalledWith("toggle");
  });

  it("SV-N-03: Returns to empty state when detail panel is closed", () => {
    // Given: A task is selected
    render(<SplitViewLayout />);
    fireEvent.click(screen.getByText("Select Task 1"));
    expect(screen.queryByText("Empty State")).not.toBeInTheDocument();

    // When: Clicking the close button in detail panel
    const closeBtn = screen.getByText("Close Detail");
    fireEvent.click(closeBtn);

    // Then: Detail panel should show empty state again
    expect(screen.getByText("Empty State")).toBeInTheDocument();
    expect(mockHapticTrigger).toHaveBeenCalledWith("tick");
  });

  it("SV-03: Has a fixed 60/40 layout split", () => {
    // When: Rendering the layout
    render(<SplitViewLayout />);

    // Then: Should have fixed width classes
    const listContainer = screen.getByTestId("task-list").parentElement;
    const detailContainer =
      screen.getByTestId("task-detail-panel").parentElement?.parentElement;

    expect(listContainer).toHaveClass("w-[60%]");
    expect(detailContainer).toHaveClass("w-[40%]");
  });
});
