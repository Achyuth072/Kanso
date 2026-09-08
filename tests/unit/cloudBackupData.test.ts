import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackupData } from "@/lib/backup/types";
import {
  collectCloudBackup,
  replaceCloudBackup,
} from "@/lib/backup/cloud-data";

/**
 * Rows are keyed by table so a mis-mapped table name (the `calendar_events`
 * table feeding the `events` field is the easy one to get wrong) shows up as a
 * wrong row, not just a wrong count.
 */
function createSupabaseStub(rowsByTable: Record<string, unknown[]>) {
  const from = vi.fn((table: string) => {
    const rows = rowsByTable[table] ?? [];
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(async (start: number) => ({
        data: start === 0 ? rows : [],
        error: null,
      })),
    };
    return builder;
  });

  return { from };
}

describe("collectCloudBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads every backed-up table and maps calendar_events onto events", async () => {
    const supabase = createSupabaseStub({
      tasks: [{ id: "task-1", content: "Write the spec" }],
      projects: [{ id: "project-1", name: "Kagelin" }],
      habits: [{ id: "habit-1", name: "Read" }],
      habit_entries: [{ id: "entry-1", habit_id: "habit-1" }],
      focus_logs: [{ id: "log-1", duration: 25 }],
      calendar_events: [{ id: "event-1", title: "Standup" }],
    });

    const backup = await collectCloudBackup(
      supabase as unknown as Parameters<typeof collectCloudBackup>[0],
    );

    expect(backup.tasks).toEqual([{ id: "task-1", content: "Write the spec" }]);
    expect(backup.projects).toEqual([{ id: "project-1", name: "Kagelin" }]);
    expect(backup.habits).toEqual([{ id: "habit-1", name: "Read" }]);
    expect(backup.habit_entries).toEqual([
      { id: "entry-1", habit_id: "habit-1" },
    ]);
    expect(backup.focus_logs).toEqual([{ id: "log-1", duration: 25 }]);
    expect(backup.events).toEqual([{ id: "event-1", title: "Standup" }]);
  });

  it("never reads connected calendar accounts into the payload", async () => {
    const supabase = createSupabaseStub({
      external_calendars: [{ id: "conn-1", name: "Work Google Calendar" }],
    });

    await collectCloudBackup(
      supabase as unknown as Parameters<typeof collectCloudBackup>[0],
    );

    expect(supabase.from).not.toHaveBeenCalledWith("external_calendars");
  });

  it("stamps metadata so a restored payload can be identified", async () => {
    const supabase = createSupabaseStub({});

    const backup: BackupData = await collectCloudBackup(
      supabase as unknown as Parameters<typeof collectCloudBackup>[0],
    );

    expect(backup.metadata.version).toBe(1);
    expect(backup.metadata.appVersion).toBeTruthy();
    expect(Date.parse(backup.metadata.exportedAt)).not.toBeNaN();
  });
});

interface RecordedOp {
  op: "upsert" | "delete";
  table: string;
  rows?: Record<string, unknown>[];
  ids?: string[];
}

/**
 * Records write traffic, and can be told to fail one table's upsert so the
 * partial-failure guarantee can be asserted.
 */
function createWriteStub(
  options: {
    existingIds?: Record<string, string[]>;
    failUpsertOn?: string;
  } = {},
) {
  const ops: RecordedOp[] = [];
  const existingIds = options.existingIds ?? {};

  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(async (start: number) => ({
        data:
          start === 0 ? (existingIds[table] ?? []).map((id) => ({ id })) : [],
        error: null,
      })),
      upsert: async (rows: Record<string, unknown>[]) => {
        if (options.failUpsertOn === table) {
          return { error: { message: `write to ${table} failed` } };
        }
        ops.push({ op: "upsert", table, rows });
        return { error: null };
      },
      delete: () => ({
        in: async (_column: string, ids: string[]) => {
          ops.push({ op: "delete", table, ids });
          return { error: null };
        },
      }),
    };
    return builder;
  });

  return { supabase: { from }, ops };
}

function backupWith(overrides: Partial<BackupData> = {}): BackupData {
  return {
    metadata: {
      version: 1,
      appVersion: "1.0.0",
      exportedAt: "2026-08-25T00:00:00.000Z",
    },
    tasks: [],
    projects: [],
    habits: [],
    habit_entries: [],
    focus_logs: [],
    events: [],
    ...overrides,
  } as BackupData;
}

function runReplace(
  supabase: unknown,
  data: BackupData,
  userId = "user-1",
): Promise<void> {
  return replaceCloudBackup(
    supabase as Parameters<typeof replaceCloudBackup>[0],
    userId,
    data,
  );
}

describe("replaceCloudBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the restored rows before removing anything", async () => {
    const { supabase, ops } = createWriteStub({
      existingIds: { tasks: ["stale-task"] },
    });

    await runReplace(
      supabase,
      backupWith({
        tasks: [{ id: "task-1" }],
      } as unknown as Partial<BackupData>),
    );

    const firstDelete = ops.findIndex((o) => o.op === "delete");
    const lastUpsert = ops.map((o) => o.op).lastIndexOf("upsert");
    expect(firstDelete).toBeGreaterThan(lastUpsert);
  });

  it("leaves the account intact when a restore fails partway", async () => {
    const { supabase, ops } = createWriteStub({
      existingIds: { tasks: ["existing-task"], projects: ["existing-project"] },
      failUpsertOn: "tasks",
    });

    await expect(
      runReplace(
        supabase,
        backupWith({
          projects: [{ id: "project-1" }],
          tasks: [{ id: "task-1" }],
        } as unknown as Partial<BackupData>),
      ),
    ).rejects.toThrow();

    // The user's rows are still there: nothing was deleted on the way out.
    expect(ops.filter((o) => o.op === "delete")).toHaveLength(0);
  });

  it("removes rows the backup no longer contains", async () => {
    const { supabase, ops } = createWriteStub({
      existingIds: { tasks: ["task-1", "deleted-elsewhere"] },
    });

    await runReplace(
      supabase,
      backupWith({
        tasks: [{ id: "task-1" }],
      } as unknown as Partial<BackupData>),
    );

    const taskDelete = ops.find(
      (o) => o.op === "delete" && o.table === "tasks",
    );
    expect(taskDelete?.ids).toEqual(["deleted-elsewhere"]);
  });

  it("splits large tables into batches rather than one oversized request", async () => {
    const habit_entries = Array.from({ length: 1200 }, (_, i) => ({
      id: `entry-${i}`,
      habit_id: "habit-1",
    }));
    const { supabase, ops } = createWriteStub();

    await runReplace(
      supabase,
      backupWith({ habit_entries } as unknown as Partial<BackupData>),
    );

    const upserts = ops.filter(
      (o) => o.op === "upsert" && o.table === "habit_entries",
    );
    expect(upserts.length).toBeGreaterThan(1);
    expect(Math.max(...upserts.map((o) => o.rows!.length))).toBeLessThanOrEqual(
      500,
    );
    expect(upserts.reduce((n, o) => n + o.rows!.length, 0)).toBe(1200);
  });

  it("writes parents before the rows that reference them", async () => {
    const { supabase, ops } = createWriteStub();

    await runReplace(
      supabase,
      backupWith({
        projects: [{ id: "project-1" }],
        habits: [{ id: "habit-1" }],
        tasks: [{ id: "task-1", project_id: "project-1" }],
        habit_entries: [{ id: "entry-1", habit_id: "habit-1" }],
      } as unknown as Partial<BackupData>),
    );

    const order = ops.filter((o) => o.op === "upsert").map((o) => o.table);
    // tasks.project_id -> projects, habit_entries.habit_id -> habits
    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("tasks"));
    expect(order.indexOf("habits")).toBeLessThan(
      order.indexOf("habit_entries"),
    );
  });

  it("preserves row ids so repeated backup/restore round trips converge", async () => {
    const { supabase, ops } = createWriteStub();

    await runReplace(
      supabase,
      backupWith({
        tasks: [{ id: "task-1", content: "Restored task" }],
      } as unknown as Partial<BackupData>),
    );

    const taskUpsert = ops.find((o) => o.table === "tasks");
    expect(taskUpsert?.rows?.[0].id).toBe("task-1");
  });

  it("reassigns ownership to the restoring user, except on habit_entries", async () => {
    const { supabase, ops } = createWriteStub();

    await runReplace(
      supabase,
      backupWith({
        tasks: [{ id: "task-1", user_id: "someone-else" }],
        habits: [{ id: "habit-1" }],
        habit_entries: [{ id: "entry-1", habit_id: "habit-1" }],
      } as unknown as Partial<BackupData>),
    );

    expect(ops.find((o) => o.table === "tasks")?.rows?.[0].user_id).toBe(
      "user-1",
    );

    // habit_entries has no user_id column; it is scoped through its habit.
    expect(
      ops.find((o) => o.table === "habit_entries")?.rows?.[0],
    ).not.toHaveProperty("user_id");
  });
});
