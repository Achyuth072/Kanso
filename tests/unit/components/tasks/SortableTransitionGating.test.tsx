/**
 * Regression test for Bug A — snap-back animation on drop.
 *
 * Root cause (per .planning/debug/dnd-phase1-diagnostic-2026-05-14.md):
 *   useSortable.transition is a string like "transform 200ms ease" whenever
 *   SortableContext.items mutates. On drop, isDragging flips false and
 *   transform becomes null — but if `transition` is still applied to the
 *   inline style, the browser animates `transform` from the last drag offset
 *   back to translate3d(0,0,0) over the transition duration. The user reads
 *   this as the dropped card "snapping back".
 *
 * Fix: gate `transition` in inline style so it is only applied while
 *   `transform != null` (idiomatic dnd-kit pattern).
 *
 * This unit test verifies the structural invariant: when `useSortable`
 * returns `transform: null` (the post-drop steady state), the rendered DOM
 * node MUST NOT carry a `transition` containing "transform" in its inline
 * style. jsdom does not run CSS transitions, but it does render the inline
 * style faithfully — so this is a sound structural regression guard.
 *
 * A full visual confirmation requires a manual repro recipe (see
 * .planning/debug/dnd-audit-2026-05-14.md for the recipe).
 */
import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { Task } from "@/lib/types/task";

// Mock useSortable to simulate the post-drop steady state:
//   - transform: null  (no drag offset)
//   - transition: "transform 200ms ease"  (residue from the SortableContext
//                                           mutation during the drag)
//   - isDragging: false
//
// The fix must ensure that the rendered inline style does NOT contain a
// `transition` value referencing `transform` under these conditions.
vi.mock("@dnd-kit/sortable", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/sortable")>(
      "@dnd-kit/sortable",
    );
  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      setActivatorNodeRef: () => {},
      transform: null,
      transition: "transform 200ms ease",
      isDragging: false,
      isOver: false,
      active: null,
      over: null,
    }),
  };
});

// Mock TaskItem to render a simple identifiable inner element — we only care
// about the outer wrapper's inline style produced by the Sortable card.
vi.mock("@/components/tasks/TaskItem", () => {
  const TaskItem = ({ task }: { task: Task }) => (
    <div data-testid={`task-item-${task.id}`}>{task.content}</div>
  );
  return { default: TaskItem, TaskItem };
});

const makeTask = (id: string): Task =>
  ({
    id,
    content: `Task ${id}`,
    day_order: 0,
    priority: 3,
    is_completed: false,
    is_evening: false,
  }) as Task;

describe("Sortable card transition gating (Bug A regression)", () => {
  it("SortableBoardTaskCard: inline style has no transform-transition when transform is null", async () => {
    const { SortableBoardTaskCard } =
      await import("@/components/tasks/SortableBoardTaskCard");
    const task = makeTask("a");
    const { container } = render(
      <SortableBoardTaskCard
        task={task}
        project={undefined}
        isDesktop={true}
      />,
    );

    // The outer wrapper is the first child of container — it carries the
    // useSortable-derived inline style.
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();

    const inlineTransition = wrapper.style.transition || "";
    // The fix gates transition on transform != null. With transform null,
    // the inline transition must not reference `transform`.
    expect(inlineTransition).not.toMatch(/transform/);
  });

  it("SortableListTaskCard: inline style has no transform-transition when transform is null", async () => {
    const SortableListTaskCardModule =
      await import("@/components/tasks/SortableListTaskCard");
    const SortableListTaskCard = SortableListTaskCardModule.default;
    const task = makeTask("b");
    const { container } = render(
      <SortableListTaskCard task={task} isDesktop={true} viewMode="list" />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();

    const inlineTransition = wrapper.style.transition || "";
    expect(inlineTransition).not.toMatch(/transform/);
  });
});
