import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { DEFAULT_PROJECT_COLOR } from "@/lib/constants/colors";

// Mock hooks
const mockMutate = vi.fn();
vi.mock("@/lib/hooks/useProjectMutations", () => ({
  useCreateProject: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const mockTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
  }),
}));

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly when open", () => {
    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Create Project")).toBeInTheDocument();
    expect(screen.getByLabelText("Project Name")).toBeInTheDocument();
  });

  it("shows validation error when name is empty and touched", async () => {
    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText("Project Name");

    await act(async () => {
      fireEvent.change(input, { target: { value: "a" } });
    });
    await act(async () => {
      fireEvent.change(input, { target: { value: "" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Project name is required")).toBeInTheDocument();
    });

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "project-name-error");
  });

  it("submits successfully with valid data", async () => {
    const onOpenChange = vi.fn();
    render(<CreateProjectDialog open={true} onOpenChange={onOpenChange} />);

    const input = screen.getByLabelText("Project Name");
    await act(async () => {
      fireEvent.change(input, { target: { value: "New Project" } });
    });

    const submitButton = screen.getByRole("button", { name: /create/i });

    // Wait for button to be enabled (isValid becoming true)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(
      () => {
        expect(mockMutate).toHaveBeenCalledWith({
          name: "New Project",
          color: DEFAULT_PROJECT_COLOR,
          view_style: "list",
        });
        expect(mockTrigger).toHaveBeenCalledWith("thud");
        expect(onOpenChange).toHaveBeenCalledWith(false);
      },
      { timeout: 3000 },
    );
  });

  it("changes color when a color button is clicked", async () => {
    render(<CreateProjectDialog open={true} onOpenChange={vi.fn()} />);

    // PROJECT_COLORS[0] is "Sumi Ink" (#1A1A1A)
    const sumiInk = screen.getByLabelText("Sumi Ink");
    await act(async () => {
      fireEvent.click(sumiInk);
    });

    expect(sumiInk).toHaveAttribute("aria-checked", "true");
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
  });
});
