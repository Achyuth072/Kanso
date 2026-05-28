import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

// ===== Hoisted mocks =====

const { mockLogSession, mockUpsertTimerState, toastMock } = vi.hoisted(() => ({
  mockLogSession: vi.fn(),
  mockUpsertTimerState: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/lib/mutations/focus", () => ({
  focusMutations: {
    logSession: mockLogSession,
    upsertTimerState: mockUpsertTimerState,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  useMutation: vi.fn(() => ({ mutate: mockLogSession })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => {
    const channelObj = {
      on: vi.fn((_event: string, _config: any, _callback: any) => channelObj),
      subscribe: vi.fn((_callback?: any) => ({
        unsubscribe: vi.fn(),
      })),
    };
    return {
      channel: vi.fn(() => channelObj),
      removeChannel: vi.fn(),
    };
  }),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: {
    getState: vi.fn(() => ({ isPipActive: false, setIsSynced: vi.fn() })),
  },
}));

vi.mock("@/lib/store/focusHistoryStore", () => ({
  useFocusHistoryStore: { getState: vi.fn(() => ({ addSession: vi.fn() })) },
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false, user: { id: "user-1" } })),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("@/lib/hooks/useFocusSounds", () => ({
  useFocusSounds: vi.fn(() => ({ play: vi.fn() })),
}));

vi.mock("@/lib/hooks/usePushNotifications", () => ({
  usePushNotifications: vi.fn(() => ({ showNotification: vi.fn() })),
}));

vi.mock("@/lib/timer-api", () => ({
  scheduleTimerNotification: vi.fn(() =>
    Promise.resolve({ success: true, notificationId: "test-id" }),
  ),
  cancelTimerNotification: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn(), isPhone: false })),
}));

describe("Focus History — cancel does not log session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    // Reset timer store to defaults
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: DEFAULT_TIMER_SETTINGS.focusDuration * 60,
        completedSessions: 0,
        activeTaskId: null,
        startedAt: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should NOT call logFocusSession when cancel() is called during an active session", async () => {
    // Given: A running timer with an active task
    useTimerStore.setState((s) => ({
      state: {
        ...s.state,
        isRunning: true,
        remainingSeconds: 1200,
        completedSessions: 2,
        activeTaskId: "task-active",
        startedAt: Date.now() - 60000, // started 1 min ago
      },
    }));

    // When: Rendering useFocusTimer and calling cancel
    const { result } = renderHook(() => useFocusTimer());

    await act(async () => {
      result.current.cancel();
    });

    // Then: logSession should NOT have been called
    expect(mockLogSession).not.toHaveBeenCalled();
  });
});
