import { render, screen } from "@testing-library/react";
import { ListTaskCard } from "@/components/tasks/ListTaskCard";
import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types/task";

const mockTask: Task = {
  id: "1",
  content: "Test Task",
  project_id: "inbox",
  priority: 1,
  is_completed: false,
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

describe("Task Item Styling Logic", () => {
  it("should apply task-ink-completed-text when completed", () => {
    const completedTask = { ...mockTask, is_completed: true };
    render(
      <ListTaskCard
        task={completedTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={() => {}}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
        onDeleteRequest={() => {}}
        project={undefined}
      />,
    );

    const content = screen.getByText("Test Task");
    expect(content.className).toContain("task-ink-completed-text");
  });

  it("should have data-animate='true' when shouldAnimate is true", () => {
    const completedTask = { ...mockTask, is_completed: true };
    render(
      <ListTaskCard
        task={completedTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={() => {}}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
        onDeleteRequest={() => {}}
        project={undefined}
        shouldAnimate={true}
      />,
    );

    const content = screen.getByText("Test Task");
    expect(content.getAttribute("data-animate")).toBe("true");
  });

  it("should have data-animate='false' when shouldAnimate is false", () => {
    const completedTask = { ...mockTask, is_completed: true };
    render(
      <ListTaskCard
        task={completedTask}
        isDesktop={true}
        isExpanded={false}
        toggleExpand={() => {}}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
        onDeleteRequest={() => {}}
        project={undefined}
        shouldAnimate={false}
      />,
    );

    const content = screen.getByText("Test Task");
    expect(content.getAttribute("data-animate")).toBe("false");
  });
});
