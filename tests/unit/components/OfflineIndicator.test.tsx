import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import React from "react";

// Mock framer-motion to avoid animation delays in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      return <div {...props}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  it("TC-N-01: should not render anything when online", () => {
    // Given: navigator.onLine = true
    // When:  OfflineIndicator renders
    // Then:  no banner in the DOM
    render(<OfflineIndicator />);
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
  });

  it("TC-N-02: should render banner when offline", () => {
    // Given: navigator.onLine = false
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });

    // When:  OfflineIndicator renders
    // Then:  banner is visible
    render(<OfflineIndicator />);
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Changes will sync when back online/i),
    ).toBeInTheDocument();
  });

  it("TC-B-01: should appear when window becomes offline", () => {
    // Given: Initially online
    render(<OfflineIndicator />);
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();

    // When:  window dispatches 'offline' event
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });

    // Then:  banner appears
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
  });

  it("TC-B-02: should disappear when window becomes online", () => {
    // Given: Initially offline
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    render(<OfflineIndicator />);
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

    // When:  window dispatches 'online' event
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });

    // Then:  banner disappears
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
  });
});
