import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import type { Project } from "@/lib/types/task";

const mockArchiveMutateAsync = vi.fn();
const mockArchiveMutate = vi.fn();
const mockMoveTasksMutateAsync = vi.fn();
const mockDeleteTasksMutateAsync = vi.fn();

vi.mock("@/lib/hooks/useProjectMutations", () => ({
  useArchiveProject: () => ({
    mutate: mockArchiveMutate,
    mutateAsync: mockArchiveMutateAsync,
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
  useMoveTasksToInbox: () => ({
    mutate: vi.fn(),
    mutateAsync: mockMoveTasksMutateAsync,
    isPending: false,
  }),
  useDeleteProjectTasks: () => ({
    mutate: vi.fn(),
    mutateAsync: mockDeleteTasksMutateAsync,
    isPending: false,
  }),
  useHardDeleteProject: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useBackNavigation", () => ({
  useBackNavigation: vi.fn(),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

const mockProject: Project = {
  id: "test-proj-1",
  user_id: "user-1",
  name: "Test Project",
  color: "#ff0000",
  view_style: "list",
  is_inbox: false,
  is_archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("DeleteProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArchiveMutateAsync.mockResolvedValue(undefined);
    mockMoveTasksMutateAsync.mockResolvedValue(undefined);
    mockDeleteTasksMutateAsync.mockResolvedValue(undefined);
  });

  it("renders correctly when open with a project", () => {
    render(
      <DeleteProjectDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />,
    );

    expect(screen.getByText("Delete Project")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Are you sure you want to delete "Test Project"\? Choose what happens to its tasks\./,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Move to Inbox" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep Archived" }),
    ).toBeInTheDocument();
  });

  it("does not render when project is null", () => {
    render(
      <DeleteProjectDialog open={true} onOpenChange={vi.fn()} project={null} />,
    );
    expect(screen.queryByText("Delete Project")).not.toBeInTheDocument();
  });

  it("calls moveTasksToInbox and archive when 'Move to Inbox' is clicked", async () => {
    render(
      <DeleteProjectDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />,
    );

    const moveBtn = screen.getByRole("button", { name: "Move to Inbox" });

    await act(async () => {
      fireEvent.click(moveBtn);
    });

    expect(mockMoveTasksMutateAsync).toHaveBeenCalledWith("test-proj-1");
    expect(mockArchiveMutateAsync).toHaveBeenCalledWith("test-proj-1");
  });

  it("calls deleteProjectTasks and archive when 'Delete All Tasks' is clicked", async () => {
    render(
      <DeleteProjectDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls only archive when 'Keep Archived' is clicked", async () => {
    render(
      <DeleteProjectDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />,
    );

    const keepBtn = screen.getByRole("button", { name: "Keep Archived" });

    await act(async () => {
      fireEvent.click(keepBtn);
    });

    expect(mockMoveTasksMutateAsync).not.toHaveBeenCalled();
    expect(mockDeleteTasksMutateAsync).not.toHaveBeenCalled();
    expect(mockArchiveMutateAsync).toHaveBeenCalledWith("test-proj-1");
  });

  it("calls onOpenChange with false when cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <DeleteProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        project={mockProject}
      />,
    );

    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
