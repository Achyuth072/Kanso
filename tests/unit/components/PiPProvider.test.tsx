import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { PiPProvider, usePiP } from "@/components/providers/PiPProvider";

// ===== Hoisted mocks =====

const { mockClosePiP, mockSetIsPipActive, mockOpenPiP } = vi.hoisted(() => ({
  mockClosePiP: vi.fn(),
  mockSetIsPipActive: vi.fn(),
  mockOpenPiP: vi.fn().mockResolvedValue(null),
}));

// ===== Reactive store mock: use a mutable ref so tests can flip values =====

let mockIsFullscreenValue = false;
let mockIsPiPActiveValue = false;

vi.mock("@/lib/hooks/useDocumentPiP", () => ({
  useDocumentPiP: () => ({
    isPiPSupported: true,
    isPiPActive: mockIsPiPActiveValue,
    pipWindow: null,
    openPiP: mockOpenPiP,
    closePiP: mockClosePiP,
  }),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: any) => any) => {
    const state = {
      isFullscreen: mockIsFullscreenValue,
      setIsFullscreen: vi.fn(),
      isPipActive: mockIsPiPActiveValue,
      setIsPipActive: mockSetIsPipActive,
      pipWindow: null,
    };
    return selector(state);
  },
}));

// ===== Helper component that reads PiP context =====

function PiPContextConsumer() {
  const pip = usePiP();
  return (
    <div>
      <span data-testid="pip-is-close-called" />
      <span data-testid="pip-is-active">
        {pip.isPiPActive ? "active" : "inactive"}
      </span>
      <span data-testid="pip-is-fullscreen">
        {pip.isFullscreen ? "fullscreen" : "windowed"}
      </span>
    </div>
  );
}

/**
 * A wrapper that re-mounts children when `key` changes.
 * This forces React reconciliation and re-reads the mocked modules.
 */
function TestHarness({
  children,
  key,
}: {
  children: React.ReactNode;
  key: string;
}) {
  return <div key={key}>{children}</div>;
}

// ===== Test suite =====

describe("PiPProvider reactive close on fullscreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFullscreenValue = false;
    mockIsPiPActiveValue = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test 1: closePiP called when fullscreen activates while PiP is active ---

  it("should call closePiP when isFullscreen flips to true and PiP is active", () => {
    // Given: PiP is active, fullscreen is false
    mockIsPiPActiveValue = true;
    mockIsFullscreenValue = false;

    // Initial mount
    const { rerender } = render(
      <div key="render-1">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    // Sanity: closePiP not called yet
    expect(mockClosePiP).not.toHaveBeenCalled();

    // When: flip fullscreen to true and force a full re-render
    mockIsFullscreenValue = true;

    rerender(
      <div key="render-2">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    // Then: closePiP should have been called exactly once
    expect(mockClosePiP).toHaveBeenCalledTimes(1);
  });

  // --- Test 2: closePiP NOT called when fullscreen activates but PiP already inactive ---

  it("should NOT call closePiP when fullscreen activates but PiP is already inactive", () => {
    // Given: PiP is NOT active, fullscreen is false
    mockIsPiPActiveValue = false;
    mockIsFullscreenValue = false;

    const { rerender } = render(
      <div key="render-1">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    expect(mockClosePiP).not.toHaveBeenCalled();

    // When: flip fullscreen to true
    mockIsFullscreenValue = true;

    rerender(
      <div key="render-2">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    // Then: closePiP should NOT have been called (PiP was already inactive)
    expect(mockClosePiP).not.toHaveBeenCalled();
  });

  // --- Test 3: closePiP NOT called when exiting fullscreen (D-09 no auto-restore) ---

  it("should NOT call closePiP when exiting fullscreen (D-09 no auto-restore)", () => {
    // Given: fullscreen is active, PiP is inactive
    mockIsFullscreenValue = true;
    mockIsPiPActiveValue = false;

    const { rerender } = render(
      <div key="render-1">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    // When: exit fullscreen
    mockIsFullscreenValue = false;

    rerender(
      <div key="render-2">
        <PiPProvider>
          <PiPContextConsumer />
        </PiPProvider>
      </div>,
    );

    // Then: closePiP should NOT have been called
    expect(mockClosePiP).not.toHaveBeenCalled();
  });

  // --- Test 4: useEffect not triggered when fullscreen true stays true (no spurious calls) ---

  it("should call closePiP only once when mounting with fullscreen AND PiP active", () => {
    // Given: already fullscreen AND PiP already active
    mockIsFullscreenValue = true;
    mockIsPiPActiveValue = true;

    render(
      <PiPProvider>
        <PiPContextConsumer />
      </PiPProvider>,
    );

    // The useEffect fires on mount: isFullscreen=true && isPiPActive=true → closePiP()
    expect(mockClosePiP).toHaveBeenCalledTimes(1);
  });
});
