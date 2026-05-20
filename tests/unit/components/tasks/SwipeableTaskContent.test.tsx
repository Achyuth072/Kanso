/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwipeableTaskContent } from "@/components/tasks/SwipeableTaskContent";
import React from "react";
import { useTransform } from "framer-motion";

// Mock framer-motion to capture props
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: (() => {
        const Div = React.forwardRef(
          (
            {
              children,
              drag,
              dragElastic,
              dragConstraints,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              initial,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              animate,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              exit,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        );
        Div.displayName = "MotionDiv";
        return Div;
      })(),
    },
    useMotionValue: vi.fn(() => ({ get: () => 0, set: vi.fn() })),
    useTransform: vi.fn((_val, _from, _to) => ({ get: () => 0 })),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("SwipeableTaskContent Drag Resistance & Thresholds", () => {
  const defaultProps = {
    children: <div>Task Content</div>,
    isDesktop: false,
    _isDragging: false,
    _viewMode: "list" as const,
    _isHandleActive: false,
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have tight dragElastic configuration (0.2) to prevent 'loose' feel", () => {
    render(<SwipeableTaskContent {...defaultProps} />);

    // The drag container is now a child motion.div
    const dragContainer = document.querySelector('div[data-drag="x"]');
    const dragElasticRaw = dragContainer?.getAttribute("data-drag-elastic");
    const dragElastic = JSON.parse(dragElasticRaw!);

    expect(dragElastic.left).toBe(0.2);
    expect(dragElastic.right).toBe(0.2);
  });

  it("should have proper physical thresholds and visual commitment points", () => {
    render(<SwipeableTaskContent {...defaultProps} />);

    const transformCalls = (vi.mocked(useTransform).mock as { calls: any[][] })
      .calls;
    // We expect 4 calls now: 2 for backgrounds, 2 for icon opacity, 2 for icon scale
    // Actually, in the new code:
    // 1. completeBgOpacity
    // 2. deleteBgOpacity
    // 3. leftIconOpacity
    // 4. rightIconOpacity
    // 5. leftIconScale
    // 6. rightIconScale

    const backgroundTransformCall = transformCalls.find(
      (call: any[]) =>
        Array.isArray(call[1]) &&
        call[1].some((t: number) => Math.abs(t) === 30),
    );

    expect(backgroundTransformCall).toBeTruthy();
    const thresholds = backgroundTransformCall![1] as number[];
    const maxVisualThreshold = Math.max(...thresholds.map(Math.abs));

    // For a 150px physical drag with 0.2 elastic, the visual offset x should be 30
    expect(maxVisualThreshold).toBe(30);
  });

  it("should make swipe rigid (dragElastic=0) instead of disabling drag to prevent DnD event bubbling when isCompleted is true", () => {
    render(<SwipeableTaskContent {...defaultProps} isCompleted={true} />);

    const dragContainer = document.querySelector('div[data-drag="x"]');
    expect(dragContainer).toBeTruthy(); // MUST still be "x" to swallow pointer events

    const dragElasticRaw = dragContainer?.getAttribute("data-drag-elastic");
    const dragElastic = JSON.parse(dragElasticRaw!);

    // MUST be rigid to prevent visual movement
    expect(dragElastic.left).toBe(0);
    expect(dragElastic.right).toBe(0);
  });
});
