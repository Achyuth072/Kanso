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

// Mock useRouter
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
  it("should have task-ink-completed-card class on TaskItem root but NOT on ListTaskCard (Desktop)", () => {
    const { container } = render(
      <TaskItem task={mockTask} isDesktop={true} viewMode="list" />,
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).toContain("task-ink-completed-card");

    const listTaskCard = rootDiv.querySelector('[data-testid="task-list-row"]');
    expect(listTaskCard?.className).not.toContain("task-ink-completed-card");

    const desktopWrapper = rootDiv.querySelector(".overflow-hidden.rounded-md");
    expect(desktopWrapper).toBeTruthy();
    expect((desktopWrapper as HTMLElement).style.isolation).toBe("isolate");
  });

  it("should have task-ink-completed-card class on TaskItem root but NOT on SwipeableTaskContent (Mobile)", () => {
    const { container } = render(
      <TaskItem task={mockTask} isDesktop={false} viewMode="list" />,
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).toContain("task-ink-completed-card");

    // SwipeableTaskContent root has "relative overflow-hidden" but should NOT have completion class
    const swipeWrapper = rootDiv.querySelector(".relative.overflow-hidden");
    expect(swipeWrapper).toBeTruthy();
    expect(swipeWrapper?.className).not.toContain("task-ink-completed-card");

    const listTaskCard = rootDiv.querySelector('[data-testid="task-list-row"]');
    expect(listTaskCard?.className).not.toContain("task-ink-completed-card");
  });
});
