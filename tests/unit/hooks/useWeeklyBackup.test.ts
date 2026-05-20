import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/backup/export-import", () => ({
  createBackupZip: vi.fn().mockResolvedValue(new Blob(["test"])),
  downloadBackup: vi.fn(),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: true }),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: {
    getTasks: vi.fn().mockReturnValue([]),
    getProjects: vi.fn().mockReturnValue([]),
    getHabits: vi.fn().mockReturnValue([]),
    getHabitEntries: vi.fn().mockReturnValue([]),
    getFocusLogs: vi.fn().mockReturnValue([]),
    getEvents: vi.fn().mockReturnValue([]),
  },
}));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "kanso_last_backup_date";
const SESSION_KEY = "kanso_backup_prompted";

describe("useWeeklyBackup", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show toast if backup is recent", async () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());

    // Dynamic import to ensure mocks are applied
    const { useWeeklyBackup } = await import("@/lib/hooks/useWeeklyBackup");
    const { toast } = await import("sonner");

    renderHook(() => useWeeklyBackup());

    // Fast-forward to account for 3s delay in hook
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(toast).not.toHaveBeenCalled();
  });

  it("shows toast if backup is older than 7 days", async () => {
    const oldDate = new Date(Date.now() - SEVEN_DAYS_MS - 1000);
    localStorage.setItem(STORAGE_KEY, oldDate.toISOString());

    const { useWeeklyBackup } = await import("@/lib/hooks/useWeeklyBackup");
    const { toast } = await import("sonner");

    renderHook(() => useWeeklyBackup());

    // Fast-forward to account for 3s delay in hook
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(toast).toHaveBeenCalledWith(
      "It's been a while since your last backup",
      expect.objectContaining({
        description: "Back up your data to prevent loss",
        action: expect.objectContaining({
          label: "Back Up Now",
        }),
      }),
    );
  });

  it("does not show toast twice in same session", async () => {
    const oldDate = new Date(Date.now() - SEVEN_DAYS_MS - 1000);
    localStorage.setItem(STORAGE_KEY, oldDate.toISOString());
    sessionStorage.setItem(SESSION_KEY, "true");

    const { useWeeklyBackup } = await import("@/lib/hooks/useWeeklyBackup");
    const { toast } = await import("sonner");

    renderHook(() => useWeeklyBackup());

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(toast).not.toHaveBeenCalled();
  });
});

// Helper for act
function act(callback: () => void) {
  callback();
}
