import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import type { Task } from "@/lib/types/task";
import { useUpdateTask, useDeleteTask } from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";

const { MockTaskEditView } = vi.hoisted(() => ({
  MockTaskEditView: (props: any) => (
    <div data-testid="task-edit-view" onKeyDown={props.onKeyDown}>
      <input
        value={props.content || ""}
        onChange={(e) => props.setContent?.(e.target.value)}
        data-testid="task-content-input"
      />
      {props.errors?.content && (
        <span data-testid="error-content">{props.errors.content.message}</span>
      )}
      <textarea
        value={props.description || ""}
        onChange={(e) => props.setDescription?.(e.target.value)}
      />
      <button
        type="submit"
        onClick={props.onSubmit}
        disabled={props.isPending || !props.hasContent}
      >
        Save
      </button>
      <button onClick={props.onDelete}>Delete Task</button>
    </div>
  ),
}));

vi.mock("next/dynamic", () => ({
  default: () => MockTaskEditView,
}));

vi.mock("./TaskEditView", () => ({
  TaskEditView: MockTaskEditView,
}));

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

// Mock DeleteConfirmationDialog to avoid complexity
vi.mock("@/components/ui/DeleteConfirmationDialog", () => ({
  DeleteConfirmationDialog: ({
    isOpen,
    onConfirm,
    title,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    title: string;
  }) =>
    isOpen ? (
      <div data-testid="delete-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    ) : null,
}));

describe("TaskDetailPanel", () => {
  const mockUpdateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();

  const mockTask: Task = {
    id: "task-1",
    content: "Test Task",
    description: "Sample Description",
    priority: 4,
    is_completed: false,
    created_at: new Date().toISOString(),
    user_id: "user-1",
  } as Task;

  beforeEach(() => {
    vi.clearAllMocks();
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    });
    (useDeleteTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    });
    (useInboxProject as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { id: "inbox-id" },
    });
    (useProjects as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });
  });

  it("TD-N-01: Renders task content correctly", async () => {
    // Given: A task is provided
    // When: Rendering the panel
    render(<TaskDetailPanel task={mockTask} />);

    // Then: Content and description should be visible
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();
    });
  });

  it("TD-N-02: Handles null task gracefully", async () => {
    // Given: No task is provided
    // When: Rendering the panel
    await act(async () => {
      render(<TaskDetailPanel task={null} />);
    });

    // Then: Empty state placeholder should be visible
    expect(
      screen.getByText(/Select a task to view details/i),
    ).toBeInTheDocument();
  });

  it("TD-N-03: Calls update mutation when saving", async () => {
    // Given: A task is provided
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} />);
    });
    const input = screen.getByDisplayValue("Test Task");

    // When: Changing content and submitting
    await act(async () => {
      fireEvent.change(input, { target: { value: "Updated Task" } });
    });

    // Wait for validation to complete and save button to enable
    const saveButton = screen.getByRole("button", { name: /save/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Then: update mutation should be called
    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "task-1",
          content: "Updated Task",
        }),
      );
    });
  });

  it("TD-N-04: Calls delete mutation on confirmation", async () => {
    // Given: A task is provided
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} />);
    });

    // When: Clicking delete and confirming in dialog
    const deleteBtn = screen.getByRole("button", { name: /delete task/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    const confirmBtn = screen.getByText("Confirm Delete");
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Then: delete mutation should be called
    expect(mockDeleteMutate).toHaveBeenCalledWith("task-1");
  });

  it("TD-N-05: Calls onClose when close button clicked", async () => {
    // Given: A task and onClose callback are provided
    const onClose = vi.fn();
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} onClose={onClose} />);
    });

    // When: Clicking the close button
    const closeBtn = screen.getByLabelText(/close task details/i);
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Then: onClose should be triggered
    expect(onClose).toHaveBeenCalled();
    expect(mockHapticTrigger).toHaveBeenCalledWith("tick");
  });

  it("TD-N-06: Resets form when task changes", async () => {
    // Given: Initially rendering with one task
    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      const result = render(<TaskDetailPanel task={mockTask} />);
      rerender = result.rerender;
    });
    expect(screen.getByDisplayValue("Test Task")).toBeInTheDocument();

    // When: Providing a different task
    const newTask = { ...mockTask, id: "task-2", content: "New Task" };
    await act(async () => {
      rerender(<TaskDetailPanel task={newTask} />);
    });

    // Then: Form should reflect the new task content
    await waitFor(() => {
      expect(screen.getByDisplayValue("New Task")).toBeInTheDocument();
    });
  });

  it("TD-E-01: Shows validation error for empty content", async () => {
    // Given: Rendering task detail
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} />);
    });
    const input = screen.getByDisplayValue("Test Task");

    // When: Clearing content
    await act(async () => {
      fireEvent.change(input, { target: { value: "" } });
    });

    // Then: Error message should appear (validation is async)
    const error = await screen.findByText(/required/i);
    expect(error).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it("TD-S-01: Handles Cmd+Enter to submit", async () => {
    // Given: Rendering task detail
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} />);
    });
    const input = screen.getByDisplayValue("Test Task");

    // When: Pressing Cmd+Enter on input
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    });

    // Then: update mutation should be called
    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalled();
    });
  });

  it("TD-S-02: Handles Escape to close", async () => {
    // Given: onClose is provided
    const onClose = vi.fn();
    await act(async () => {
      render(<TaskDetailPanel task={mockTask} onClose={onClose} />);
    });
    const panel = screen.getByDisplayValue("Test Task");

    // When: Pressing Escape
    await act(async () => {
      fireEvent.keyDown(panel, { key: "Escape" });
    });

    // Then: onClose should be called
    expect(onClose).toHaveBeenCalled();
  });
});
