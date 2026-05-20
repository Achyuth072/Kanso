import { render, screen } from "@testing-library/react";
import { BoardTaskCard } from "@/components/tasks/BoardTaskCard";
import { describe, it, expect } from "vitest";
import type { Task } from "@/lib/types/task";

describe("BoardTaskCard Visuals", () => {
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

  const mockProject = { color: "#ff0000", name: "Inbox" };

  it("should have 'group' class on the container for hover functionality", () => {
    const { container } = render(
      <BoardTaskCard
        task={mockTask}
        project={mockProject}
        _isDesktop={true}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
      />,
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("group");
  });

  it("should have metadata elements that are always visible", () => {
    render(
      <BoardTaskCard
        task={mockTask}
        project={mockProject}
        _isDesktop={true}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
      />,
    );

    // Check for always-visible metadata (Calendar and Flag icons)
    expect(screen.getByText("Jan 1")).toBeTruthy();
    expect(screen.getByText("P1")).toBeTruthy();

    // Verify footer doesn't fade anymore (metadata row is now part of the content stack)
    const dateText = screen.getByText("Jan 1");
    const metadataRow = dateText.parentElement;
    expect(metadataRow?.className).not.toContain("group-hover/card:opacity-0");
  });

  it("should display project accent bar when project is provided", () => {
    const { container } = render(
      <BoardTaskCard
        task={mockTask}
        project={mockProject}
        _isDesktop={true}
        handleComplete={() => {}}
        handlePlayFocus={() => {}}
      />,
    );

    // Find the accent bar div by its style
    const accentBar = container.querySelector(
      'div[style*="background-color: rgb(255, 0, 0)"]',
    );
    expect(accentBar).toBeTruthy();
    expect(accentBar?.className).toContain("absolute left-0");
  });
});
