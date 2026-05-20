import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";
import { useTimerStore } from "@/lib/store/timerStore";

// Mock dependencies
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user" } } }),
      ),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false }),
}));

vi.mock("@/lib/hooks/useFocusSounds", () => ({
  useFocusSounds: () => ({ play: vi.fn() }),
}));

vi.mock("@/lib/store/focusHistoryStore", () => ({
  useFocusHistoryStore: {
    getState: () => ({ addSession: vi.fn() }),
  },
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: { getState: vi.fn(() => ({ isPipActive: false })) },
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
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
  toast: vi.fn(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn(), isPhone: false })),
}));

describe("useFocusTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset store state
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: 1500,
        completedSessions: 0,
        activeTaskId: null,
        startedAt: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
    });
  });

  it("should initialize with default settings and state", () => {
    const { result } = renderHook(() => useFocusTimer());

    expect(result.current.settings).toEqual(DEFAULT_TIMER_SETTINGS);
    expect(result.current.state.mode).toBe("focus");
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.remainingSeconds).toBe(
      DEFAULT_TIMER_SETTINGS.focusDuration * 60,
    );
  });

  it("should start and pause the timer", async () => {
    const { result } = renderHook(() => useFocusTimer());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state.isRunning).toBe(true);

    act(() => {
      result.current.pause();
    });
    expect(result.current.state.isRunning).toBe(false);
  });

  it("should stop and reset the timer", async () => {
    const { result } = renderHook(() => useFocusTimer());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.state.mode).toBe("focus");
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.remainingSeconds).toBe(
      DEFAULT_TIMER_SETTINGS.focusDuration * 60,
    );
  });

  it("should transition from focus to shortBreak and back", () => {
    // Inject custom settings for faster testing (1 min focus)
    const { result } = renderHook(() => useFocusTimer());

    act(() => {
      result.current.updateSettings({
        focusDuration: 1,
        shortBreakDuration: 5,
      });
    });

    // Manually trigger skip to simulate timer completion
    act(() => {
      result.current.skip();
    });

    expect(result.current.state.mode).toBe("shortBreak");
    expect(result.current.state.remainingSeconds).toBe(300); // 5 * 60

    act(() => {
      result.current.skip();
    });

    expect(result.current.state.mode).toBe("focus");
  });

  it("should transition to longBreak after completed sessions", () => {
    const { result } = renderHook(() => useFocusTimer());

    act(() => {
      result.current.updateSettings({ sessionsBeforeLongBreak: 2 });
    });

    // Focus 1 -> completion -> Break -> completion
    act(() => {
      result.current.skip();
    }); // To Break 1
    act(() => {
      result.current.skip();
    }); // To Focus 2
    act(() => {
      result.current.skip();
    }); // To Long Break

    expect(result.current.state.mode).toBe("longBreak");
  });

  it("should reset completedSessions only AFTER longBreak", () => {
    const { result } = renderHook(() => useFocusTimer());

    act(() => {
      result.current.updateSettings({ sessionsBeforeLongBreak: 2 });
    });

    // Session 1 -> completion -> Short Break
    act(() => {
      result.current.skip();
    });
    expect(result.current.state.mode).toBe("shortBreak");
    expect(result.current.state.completedSessions).toBe(1);

    // Short Break -> completion -> Focus 2
    act(() => {
      result.current.skip();
    });
    expect(result.current.state.mode).toBe("focus");
    expect(result.current.state.completedSessions).toBe(1);

    // Session 2 -> completion -> Long Break
    act(() => {
      result.current.skip();
    });
    expect(result.current.state.mode).toBe("longBreak");
    expect(result.current.state.completedSessions).toBe(2); // Kept during break

    // Long Break -> completion -> Focus 1
    act(() => {
      result.current.skip();
    });
    expect(result.current.state.mode).toBe("focus");
    expect(result.current.state.completedSessions).toBe(0); // Reset after break
  });
});
