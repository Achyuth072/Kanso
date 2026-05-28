import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { FocusSyncIndicator } from "@/components/FocusSyncIndicator";

// ===== Hoisted mocks =====

const { mockSetIsSynced } = vi.hoisted(() => ({
  mockSetIsSynced: vi.fn(),
}));

// ===== Mock state control =====

let mockIsSynced = false;
let mockIsGuestMode = false;
let mockIsRunning = false;
let mockRemainingSeconds = 1500;
const TOTAL_SECONDS = 1500;

// ===== Module mocks =====

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: any) => any) => {
    const state = {
      isSynced: mockIsSynced,
      setIsSynced: mockSetIsSynced,
    };
    return selector(state);
  },
}));

vi.mock("@/lib/store/timerStore", () => ({
  useTimerStore: (selector: (state: any) => any) => {
    const state = {
      state: {
        isRunning: mockIsRunning,
        remainingSeconds: mockRemainingSeconds,
        mode: "focus",
      },
      settings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
      },
    };
    return selector(state);
  },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    isGuestMode: mockIsGuestMode,
    user: mockIsGuestMode ? { id: "guest" } : { id: "user-1" },
  }),
}));

vi.mock("lucide-react", () => ({
  Link2: (props: any) => <svg data-testid="link2-icon" {...props} />,
}));

describe("FocusSyncIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSynced = true;
    mockIsGuestMode = false;
    mockIsRunning = true;
    mockRemainingSeconds = 1200;
  });

  // --- Test 4: Link2 with text-brand/opacity-70 when synced and active ---

  it("should render Link2 icon with text-brand/opacity-70 when synced and timer is active", () => {
    mockIsSynced = true;
    mockIsRunning = true;

    render(<FocusSyncIndicator />);

    const icon = screen.getByTestId("link2-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute("class")).toContain("text-brand");
    expect(icon.getAttribute("class")).toContain("opacity-70");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Session syncing across devices",
    );
  });

  // --- Test 5: muted/opacity-30 when not synced ---

  it("should render icon with text-muted-foreground/opacity-30 when not synced", () => {
    mockIsSynced = false;
    mockIsRunning = true;

    render(<FocusSyncIndicator />);

    const icon = screen.getByTestId("link2-icon");
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute("class")).toContain("text-muted-foreground");
    expect(icon.getAttribute("class")).toContain("opacity-30");
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Offline — session not syncing",
    );
  });

  // --- Test 6: Hidden when user is guest ---

  it("should not render when user is guest", () => {
    mockIsGuestMode = true;
    mockIsRunning = true;

    const { container } = render(<FocusSyncIndicator />);
    expect(container.innerHTML).toBe("");
  });

  // --- Test 7: Hidden when no timer session is active ---

  it("should not render when no timer session is active", () => {
    mockIsRunning = false;
    mockRemainingSeconds = TOTAL_SECONDS;

    const { container } = render(<FocusSyncIndicator />);
    expect(container.innerHTML).toBe("");
  });
});
