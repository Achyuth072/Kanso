import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock Supabase
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  eq: vi.fn().mockResolvedValue({ error: null }),
  in: vi.fn().mockResolvedValue({ error: null }),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockResolvedValue({ data: [], error: null }),
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.delete.mockReturnValue(mockQuery);
mockQuery.eq.mockImplementation(async () => ({ data: [], error: null }));
mockQuery.in.mockImplementation(async () => ({ data: [], error: null }));

const mockSupabase = {
  from: vi.fn(() => mockQuery),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user" } } }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock Auth
vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" }, isGuestMode: false })),
}));

// Mock export-import
vi.mock("@/lib/backup/export-import", () => ({
  createBackupZip: vi
    .fn()
    .mockResolvedValue(new Blob(["test"], { type: "application/zip" })),
  parseBackupZip: vi.fn().mockResolvedValue({
    metadata: { version: 1, exportedAt: "2024-01-01", appVersion: "1.0.0" },
    tasks: [{ id: "task-1", content: "Task 1" }],
    projects: [],
    habits: [],
    habit_entries: [],
    focus_logs: [],
    events: [],
  }),
  downloadBackup: vi.fn(),
}));

// Mock notify
vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn((p) => p),
  },
}));

import { useAccountData } from "@/lib/hooks/useAccountData";

describe("useAccountData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exportData fetches all data and triggers download", async () => {
    const { result } = renderHook(() => useAccountData());

    await result.current.exportData();

    // Should fetch from all 6 tables
    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(mockSupabase.from).toHaveBeenCalledWith("projects");
    expect(mockSupabase.from).toHaveBeenCalledWith("habits");
    expect(mockSupabase.from).toHaveBeenCalledWith("habit_entries");
    expect(mockSupabase.from).toHaveBeenCalledWith("focus_logs");
    expect(mockSupabase.from).toHaveBeenCalledWith("calendar_events");

    const { createBackupZip, downloadBackup } =
      await import("@/lib/backup/export-import");
    expect(createBackupZip).toHaveBeenCalled();
    expect(downloadBackup).toHaveBeenCalled();
  });

  it("importData parses ZIP and inserts data with new IDs", async () => {
    const { result } = renderHook(() => useAccountData());
    const mockFile = new File(["test"], "backup.zip", {
      type: "application/zip",
    });

    await result.current.importData(mockFile);

    const { parseBackupZip } = await import("@/lib/backup/export-import");
    expect(parseBackupZip).toHaveBeenCalled();

    // Should insert tasks
    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(mockSupabase.from().insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "test-user" }),
      ]),
    );

    // Verify ID was remapped (not "task-1" anymore)
    const _lastCallIndex = mockSupabase.from.mock.calls.findIndex(
      (call: string[]) => call[0] === "tasks",
    );
    const insertCall = mockSupabase.from().insert.mock.calls[0][0];
    expect(insertCall[0].id).not.toBe("task-1");
  });

  it("clearCloudData deletes all user data", async () => {
    const { result } = renderHook(() => useAccountData());

    await result.current.clearCloudData();

    // Should call delete on all tables
    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(mockSupabase.from().delete).toHaveBeenCalled();
    expect(mockSupabase.from().eq).toHaveBeenCalledWith("user_id", "test-user");
  });

  it("importData retries calendar_events row by row on an ics_uid conflict, skipping only the conflicting rows", async () => {
    const { parseBackupZip } = await import("@/lib/backup/export-import");
    vi.mocked(parseBackupZip).mockResolvedValueOnce({
      metadata: { version: 1, exportedAt: "2024-01-01", appVersion: "1.0.0" },
      tasks: [],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
      events: [
        { id: "evt-1", ics_uid: "dupe" },
        { id: "evt-2", ics_uid: "unique" },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const rowInserts: Array<{ ics_uid?: string }> = [];
    mockQuery.insert.mockImplementation((payload: unknown) => {
      if (Array.isArray(payload)) {
        return Promise.resolve({
          error: { code: "23505", message: "duplicate key value" },
        });
      }
      const row = payload as { ics_uid?: string };
      rowInserts.push(row);
      return Promise.resolve({
        error:
          row.ics_uid === "dupe"
            ? { code: "23505", message: "duplicate key value" }
            : null,
      });
    });

    const { result } = renderHook(() => useAccountData());
    const mockFile = new File(["test"], "backup.zip", {
      type: "application/zip",
    });

    await expect(result.current.importData(mockFile)).resolves.not.toThrow();
    expect(rowInserts.map((r) => r.ics_uid)).toEqual(["dupe", "unique"]);
  });
});
