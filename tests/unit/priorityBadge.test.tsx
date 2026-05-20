import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "../../src/components/tasks/PriorityBadge";
import React from "react";

describe("PriorityBadge", () => {
  it("renders priority 1 correctly", () => {
    render(<PriorityBadge priority={1} />);
    expect(screen.getByText("P1")).toBeDefined();
    expect(screen.getByRole("img", { hidden: true })).toBeDefined(); // Flag icon
  });

  it("renders priority 2 correctly", () => {
    render(<PriorityBadge priority={2} />);
    expect(screen.getByText("P2")).toBeDefined();
  });

  it("renders priority 3 correctly", () => {
    render(<PriorityBadge priority={3} />);
    expect(screen.getByText("P3")).toBeDefined();
  });

  it("does not render priority 4", () => {
    const { container } = render(<PriorityBadge priority={4} />);
    expect(container.firstChild).toBeNull();
  });

  it("handles missing priority gracefully", () => {
    // @ts-ignore
    const { container } = render(<PriorityBadge priority={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
