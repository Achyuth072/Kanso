import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TaskSheet from "@/components/tasks/TaskSheet";
import type { Task } from "@/lib/types/task";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useToggleTask,
} from "@/lib/hooks/useTaskMutations";
import { useInboxProject } from "@/lib/hooks/useTasks";
import { useProjects } from "@/lib/hooks/useProjects";
import { useAuth } from "@/components/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderWithQuery = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  useToggleTask: vi.fn(),
}));

vi.mock("@/lib/hooks/useTasks", () => ({
  useInboxProject: vi.fn(),
}));

vi.mock("@/lib/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: true, user: { id: "user-123" } })),
}));

vi.mock("@/lib/hooks/useSubtasks", () => ({
  useSubtasks: vi.fn(() => ({ data: [], isLoading: false })),
}));

const mockHapticTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockHapticTrigger,
    isPhone: false,
  }),
}));

describe("TaskSheet", () => {
  const mockCreateMutate = vi.fn();
  const mockUpdateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockCreateMutate,
      mutateAsync: mockCreateMutate,
      isPending: false,
    });
    (useUpdateTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUpdateMutate,
      mutateAsync: mockUpdateMutate,
      isPending: false,
    });
    (useDeleteTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockDeleteMutate,
      mutateAsync: mockDeleteMutate,
      isPending: false,
    });
    (useToggleTask as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    });
    (useInboxProject as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { id: "inbox-id" },
    });
    (useProjects as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
    });
  });

  it('renders "New Task" header in creation mode', async () => {
    await act(async () => {
      renderWithQuery(<TaskSheet open={true} onClose={() => {}} />);
    });
    expect(await screen.findByText("New Task")).toBeInTheDocument();
  });

  it('renders "Edit Task" header in edit mode', async () => {
    const mockTask = {
      id: "1",
      content: "Existing Task",
      priority: 4,
      is_completed: false,
    } as unknown as Task;
    await act(async () => {
      renderWithQuery(
        <TaskSheet open={true} onClose={() => {}} initialTask={mockTask} />,
      );
    });
    expect((await screen.findAllByText("Edit Task"))[0]).toBeInTheDocument();
  });

  it("validates: shows error for content > 500 chars", async () => {
    await act(async () => {
      renderWithQuery(<TaskSheet open={true} onClose={() => {}} />);
    });
    const input = await screen.findByPlaceholderText("What needs to be done?");

    await act(async () => {
      fireEvent.change(input, { target: { value: "a".repeat(501) } });
    });

    // Wait for the async validation and UI update
    const error = await screen.findByText(/500/i);
    expect(error).toBeInTheDocument();
  });

  it("calls updateTask mutation when saving edits", async () => {
    const mockTask = {
      id: "1",
      content: "Original Task",
      priority: 4,
      is_completed: false,
    } as unknown as Task;

    await act(async () => {
      renderWithQuery(
        <TaskSheet open={true} onClose={() => {}} initialTask={mockTask} />,
      );
    });

    // Verify we're in edit mode
    expect((await screen.findAllByText("Edit Task"))[0]).toBeInTheDocument();

    // Change content
    const input = await screen.findByPlaceholderText("What needs to be done?");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Updated Task Content" } });
    });

    // Find the save button and wait for it to become enabled (validation is async)
    const saveButton = screen.getByRole("button", { name: /save/i });
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Submit form (Save)
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "1",
          content: "Updated Task Content",
        }),
      );
      // Verify signature haptic for task update
      expect(mockHapticTrigger).toHaveBeenCalledWith("thud");
    });
  });
});
