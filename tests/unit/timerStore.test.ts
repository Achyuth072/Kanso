import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTimerStore } from "@/lib/store/timerStore";
import { DEFAULT_TIMER_SETTINGS } from "@/lib/types/timer";

/**
 * Timer Store Test Perspectives
 *
 * | Perspective | Target | Verification |
 * |-------------|--------|--------------|
 * | Initialization | useTimerStore | Correct default values and loaded state |
 * | Controls | start/pause/stop | State transitions and startedAt timestamps |
 * | Ticking | tick | decrement remainingSeconds and handle completion |
 * | Settings | updateSettings | duration sync when idle |
 */

describe("useTimerStore", () => {
  beforeEach(() => {
    // Reset state before each test
    const { settings } = useTimerStore.getState();
    useTimerStore.setState({
      state: {
        mode: "focus",
        isRunning: false,
        remainingSeconds: settings.focusDuration * 60,
        completedSessions: 0,
        activeTaskId: null,
        startedAt: null,
      },
      settings: DEFAULT_TIMER_SETTINGS,
      isLoaded: true,
    });
    vi.useFakeTimers();
  });

  it("should have correct initial values", () => {
    // Given: The store is initialized
    const { state, settings } = useTimerStore.getState();

    // Then: It should have default focus settings and idle state
    expect(state.mode).toBe("focus");
    expect(state.isRunning).toBe(false);
    expect(state.remainingSeconds).toBe(settings.focusDuration * 60);
  });

  it("should start the timer with a task ID", () => {
    // Given: A task ID
    const taskId = "task-123";

    // When: Starting the timer
    useTimerStore.getState().start(taskId);

    // Then: State should be running and activeTaskId set
    const { state } = useTimerStore.getState();
    expect(state.isRunning).toBe(true);
    expect(state.activeTaskId).toBe(taskId);
    expect(state.startedAt).not.toBeNull();
  });

  it("should pause the timer", () => {
    // Given: A running timer
    useTimerStore.getState().start();
    expect(useTimerStore.getState().state.isRunning).toBe(true);

    // When: Pausing the timer
    useTimerStore.getState().pause();

    // Then: State should not be running
    const { state } = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.startedAt).toBeNull();
  });

  it("should decrement remainingSeconds on tick", () => {
    // Given: A running timer with 1500 seconds
    useTimerStore.getState().start();
    const initialSeconds = useTimerStore.getState().state.remainingSeconds;

    // When: Ticking once
    useTimerStore.getState().tick();

    // Then: remainingSeconds should be 1499
    expect(useTimerStore.getState().state.remainingSeconds).toBe(
      initialSeconds - 1,
    );
  });

  it("should handle timer completion on tick", () => {
    // Given: A running timer with 1 second left
    useTimerStore.setState((s) => ({
      state: { ...s.state, isRunning: true, remainingSeconds: 0 },
    }));

    // When: Ticking once
    useTimerStore.getState().tick();

    // Then: It should transition to shortBreak (default)
    const { state } = useTimerStore.getState();
    expect(state.mode).toBe("shortBreak");
    expect(state.completedSessions).toBe(1);
  });

  it("should stop and reset the timer", () => {
    // Given: A running timer with some progress
    useTimerStore.getState().start();
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().state.isRunning).toBe(true);

    // When: Stopping the timer
    useTimerStore.getState().stop();

    // Then: It should return to initial state
    const { state, settings } = useTimerStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.remainingSeconds).toBe(settings.focusDuration * 60);
    expect(state.completedSessions).toBe(0);
  });

  it("should update settings and sync idle timer", () => {
    // Given: An idle timer
    expect(useTimerStore.getState().state.isRunning).toBe(false);

    // When: Updating focusDuration to 30 minutes
    useTimerStore.getState().updateSettings({ focusDuration: 30 });

    // Then: settings should be updated AND remainingSeconds should sync to 1800
    const { state, settings } = useTimerStore.getState();
    expect(settings.focusDuration).toBe(30);
    expect(state.remainingSeconds).toBe(1800);
  });

  describe("cancel", () => {
    it("should preserve completedSessions while resetting all other timer state", () => {
      // Given: A running timer with 3 completed sessions and some progress
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          isRunning: true,
          remainingSeconds: 500,
          completedSessions: 3,
          activeTaskId: "task-1",
          startedAt: Date.now(),
        },
      }));

      // When: Cancelling the timer
      useTimerStore.getState().cancel();

      // Then: completedSessions preserved, everything else reset
      const { state, settings } = useTimerStore.getState();
      expect(state.mode).toBe("focus");
      expect(state.isRunning).toBe(false);
      expect(state.remainingSeconds).toBe(settings.focusDuration * 60);
      expect(state.activeTaskId).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.completedSessions).toBe(3);
    });

    it("should preserve completedSessions at 3 after cancel", () => {
      // Given: A running timer with 3 completed sessions
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          isRunning: true,
          remainingSeconds: 800,
          completedSessions: 3,
          activeTaskId: "task-2",
          startedAt: Date.now(),
        },
      }));

      // When: Cancelling the timer
      useTimerStore.getState().cancel();

      // Then: completedSessions remains 3
      expect(useTimerStore.getState().state.completedSessions).toBe(3);
    });

    it("should allow stop() after cancel to reset completedSessions to 0 (stop semantics unchanged)", () => {
      // Given: A timer after cancel with completedSessions preserved at 3
      useTimerStore.setState((s) => ({
        state: {
          ...s.state,
          isRunning: false,
          remainingSeconds: 1500,
          completedSessions: 3,
          activeTaskId: null,
          startedAt: null,
        },
      }));

      // When: Calling stop() after cancel
      useTimerStore.getState().stop();

      // Then: completedSessions resets to 0 (stop semantics unchanged)
      expect(useTimerStore.getState().state.completedSessions).toBe(0);
    });
  });
});
