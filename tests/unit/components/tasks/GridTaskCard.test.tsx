import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GridTaskCard } from "@/components/tasks/GridTaskCard";
import React from "react";
import type { Task } from "@/lib/types/task";
import { useTransform } from "framer-motion";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock framer-motion to capture props
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: React.forwardRef(
        (
          {
            children,
            drag,
            dragElastic,
            dragConstraints,
            initial,
            animate,
            exit,
            transition,
            ...props
          }: any,
          ref: any,
        ) => {
          return (
            <div
              {...props}
              ref={ref}
              data-drag={drag}
              data-drag-elastic={
                dragElastic ? JSON.stringify(dragElastic) : undefined
              }
              data-drag-constraints={
                dragConstraints ? JSON.stringify(dragConstraints) : undefined
              }
            >
              {children}
            </div>
          );
        },
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useMotionValue: vi.fn(() => ({ get: () => 0, set: vi.fn() })),
    useTransform: vi.fn((val, from, to) => ({ get: () => 0 })),
  };
});

// Mock mutations
vi.mock("@/lib/hooks/useTaskMutations", () => ({
  useToggleTask: () => ({
    mutate: vi.fn(),
  }),
}));

describe("GridTaskCard Drag Resistance & Thresholds", () => {
  const mockTask: Task = {
    id: "1",
    content: "Test Task",
    project_id: "inbox",
    priority: 1,
    is_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: "user1",
  } as any;

  const defaultProps = {
    task: mockTask,
    isDesktop: false,
    triggerHaptic: vi.fn(),
    setActiveTaskId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have tight dragElastic configuration (0.2) to prevent 'loose' feel", () => {
    render(<GridTaskCard {...defaultProps} />);

    const dragContainer = document.querySelector('div[data-drag="x"]');
    const dragElasticRaw = dragContainer?.getAttribute("data-drag-elastic");
    const dragElastic = JSON.parse(dragElasticRaw!);

    expect(dragElastic.left).toBe(0.2);
    expect(dragElastic.right).toBe(0.2);
  });

  it("should have proper physical thresholds and visual commitment points", () => {
    render(<GridTaskCard {...defaultProps} />);

    const transformCalls = (vi.mocked(useTransform).mock as any).calls;
    const backgroundTransformCall = transformCalls.find(
      (call: any) =>
        Array.isArray(call[1]) &&
        call[1].some((t: number) => Math.abs(t) === 30),
    );

    expect(backgroundTransformCall).toBeTruthy();
    const thresholds = backgroundTransformCall[1] as number[];
    const maxVisualThreshold = Math.max(...thresholds.map(Math.abs));

    // For 150px physical drag with 0.2 elastic, the visual offset x should be 30
    expect(maxVisualThreshold).toBe(30);
  });
});
