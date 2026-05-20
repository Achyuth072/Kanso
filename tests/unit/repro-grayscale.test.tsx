import { render } from "@testing-library/react";
import { TaskItem } from "@/components/tasks/TaskItem";
import { describe, it, expect, vi } from "vitest";
import type { Task } from "@/lib/types/task";

// Mock hooks
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useDeleteTask: () => ({ mutate: vi.fn() }),
  useToggleTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "user1" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockTask: Task = {
  id: "1",
  content: "Test Task",
  project_id: "inbox",
  priority: 1,
  is_completed: true,
  due_date: "2024-01-01",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_evening: false,
  day_order: 0,
  user_id: "user1",
  parent_id: null,
  description: null,
  do_date: null,
  completed_at: null,
  recurrence: null,
  google_event_id: null,
  google_etag: null,
};

describe("TaskItem Grayscale Consolidation", () => {
  it("should have task-ink-completed-card class when completed", () => {
    const { container } = render(
      <TaskItem task={mockTask} isDesktop={true} viewMode="list" />,
    );

    const rootDiv = container.firstChild as HTMLElement;
    console.log("Root classes:", rootDiv.className);
    expect(rootDiv.className).toContain("task-ink-completed-card");
  });
});
