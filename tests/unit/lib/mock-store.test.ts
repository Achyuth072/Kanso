import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  mockStore,
  STORAGE_KEY,
  stripDemoData,
  createSeededRandom,
} from "@/lib/mock/mock-store";
import type { HabitEntry } from "@/lib/types/habit";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const seededReset = () => mockStore.reset(createSeededRandom(1));

const makeEntries = (count: number): HabitEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    habit_id: "habit-1",
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    value: 1,
    created_at: new Date().toISOString(),
  }));

describe("MockStore (Guest Mode Data)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize with empty data when cleared", () => {
    const tasks = mockStore.getTasks();
    expect(tasks).toEqual([]);
  });

  it("should add a task and persist to localStorage", () => {
    const newTask = mockStore.addTask({
      content: "Test Task",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    expect(newTask.id).toBeDefined();
    expect(mockStore.getTasks()).toHaveLength(1);
    expect(mockStore.getTasks()[0].content).toBe("Test Task");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.tasks).toHaveLength(1);
    expect(stored.tasks[0].content).toBe("Test Task");
  });

  it("should update a task correctly", () => {
    const task = mockStore.addTask({
      content: "Original Content",
      project_id: null,
      parent_id: null,
      description: null,
      priority: 4,
      due_date: null,
      do_date: null,
      is_evening: false,
      is_completed: false,
      completed_at: null,
      day_order: 0,
      recurrence: null,
      google_event_id: null,
      google_etag: null,
    });

    const updated = mockStore.updateTask(task.id, {
      content: "Updated Content",
    });

    expect(updated).not.toBeNull();
    expect(updated?.content).toBe("Updated Content");
    expect(mockStore.getTask(task.id)?.content).toBe("Updated Content");

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.tasks[0].content).toBe("Updated Content");
  });

  it("should return null when updating a non-existent task", () => {
    const result = mockStore.updateTask("non-existent-id", {
      content: "New Content",
    });
    expect(result).toBeNull();
  });

  it("should seed a recurring task Series in initial data", () => {
    seededReset();

    const seriesTasks = mockStore
      .getTasks()
      .filter((t) => t.recurring_series_id !== null);

    expect(seriesTasks.length).toBeGreaterThanOrEqual(2);
    const seriesIds = new Set(seriesTasks.map((t) => t.recurring_series_id));
    expect(seriesIds.size).toBe(1);

    expect(seriesTasks.some((t) => t.is_completed)).toBe(true);
    expect(seriesTasks.some((t) => !t.is_completed)).toBe(true);
    expect(seriesTasks.every((t) => t.recurrence !== null)).toBe(true);
  });

  it("recognizes seeded habit and task ids as seed ids, and survives a reload", () => {
    seededReset();

    const seedHabitId = mockStore.getHabits()[0].id;
    const seedTaskId = mockStore.getTasks()[0].id;
    expect(mockStore.isSeedId(seedHabitId)).toBe(true);
    expect(mockStore.isSeedId(seedTaskId)).toBe(true);
    expect(mockStore.isSeedId("user-created-id")).toBe(false);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.seed_ids).toEqual(
      expect.arrayContaining([seedHabitId, seedTaskId]),
    );
  });

  it("marks seeded projects and events as demo items too", () => {
    seededReset();

    for (const project of mockStore.getProjects()) {
      expect(mockStore.isSeedId(project.id)).toBe(true);
    }
    const events = mockStore.getEvents();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(mockStore.isSeedId(event.id)).toBe(true);
    }
  });

  it("has no seed ids after clearData or restoreBackup — those aren't demo content", () => {
    seededReset();
    mockStore.clearData();
    expect(mockStore.isSeedId("anything")).toBe(false);
  });

  it("reports Demo mode while a seeded item remains, and leaves it once cleared", () => {
    seededReset();
    expect(mockStore.isInDemoMode()).toBe(true);

    mockStore.clearData();
    expect(mockStore.isInDemoMode()).toBe(false);
  });

  it("exits Demo mode once every seeded item has been deleted individually", () => {
    seededReset();
    expect(mockStore.isInDemoMode()).toBe(true);

    for (const task of mockStore.getTasks()) mockStore.deleteTask(task.id);
    for (const habit of mockStore.getHabits()) mockStore.deleteHabit(habit.id);
    for (const project of mockStore.getProjects())
      mockStore.deleteProject(project.id);
    for (const event of mockStore.getEvents()) mockStore.deleteEvent(event.id);

    expect(mockStore.isInDemoMode()).toBe(false);
  });

  it("propagates the seed exemption to a new occurrence spawned from a seeded recurring series", () => {
    seededReset();
    const seedSeriesId = mockStore
      .getTasks()
      .find((t) => t.recurring_series_id !== null)?.recurring_series_id;
    if (!seedSeriesId) throw new Error("expected a seeded recurring series");

    const nextOccurrence = mockStore.addTask({
      content: "Weekly Review",
      recurring_series_id: seedSeriesId,
      recurrence: { freq: "WEEKLY", interval: 1 },
      is_completed: false,
    });

    expect(mockStore.isSeedId(nextOccurrence.id)).toBe(true);
  });

  it("does not exempt a new occurrence of a series the guest created themselves", () => {
    seededReset();
    const ownSeriesId = "user-series-1";
    const firstOwn = mockStore.addTask({
      content: "My recurring task",
      recurring_series_id: ownSeriesId,
      is_completed: false,
    });
    expect(mockStore.isSeedId(firstOwn.id)).toBe(false);

    const nextOwn = mockStore.addTask({
      content: "My recurring task",
      recurring_series_id: ownSeriesId,
      is_completed: false,
    });
    expect(mockStore.isSeedId(nextOwn.id)).toBe(false);
  });
});

// See docs/adr/0014-demo-data-stripped-on-signup-migration.md.
describe("stripDemoData", () => {
  const readGuestData = () =>
    JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Parameters<
      typeof stripDemoData
    >[0];

  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("removes demo tasks and habits while keeping the guest's own", () => {
    seededReset();
    const own = mockStore.addTask({
      content: "My own task",
      is_completed: false,
    });

    const stripped = stripDemoData(readGuestData());

    expect(stripped.tasks.map((t) => t.id)).toEqual([own.id]);
    expect(stripped.habits).toEqual([]);
    expect(stripped.events).toEqual([]);
    expect(stripped.seed_ids).toEqual([]);
  });

  it("cascades to habit entries and focus logs, so no fabricated history survives, but the guest's own survives with it", () => {
    seededReset();
    const ownTask = mockStore.addTask({
      content: "My own task",
      is_completed: false,
    });
    const ownTaskLog = mockStore.addFocusLog({
      user_id: "guest",
      task_id: ownTask.id,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: 600,
    });
    const untetheredLog = mockStore.addFocusLog({
      user_id: "guest",
      task_id: null,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: 300,
    });
    const ownHabit = mockStore.addHabit({
      name: "My own habit",
      description: null,
      color: "#000000",
      icon: null,
      start_date: null,
      archived_at: null,
    });
    const ownEntry = mockStore.setHabitEntry(ownHabit.id, "2026-01-01", 1);
    if (!ownEntry) throw new Error("expected setHabitEntry to create an entry");

    const raw = readGuestData();
    expect(raw.habit_entries.length).toBeGreaterThan(1);
    expect(raw.focus_logs.some((l) => l.task_id !== null)).toBe(true);

    const stripped = stripDemoData(raw);

    expect(stripped.habit_entries.map((e) => e.id)).toEqual([ownEntry.id]);
    expect(stripped.focus_logs.map((l) => l.id).sort()).toEqual(
      [ownTaskLog.id, untetheredLog.id].sort(),
    );
  });

  it("keeps a demo project that still holds the guest's own task, and drops the rest", () => {
    seededReset();
    const demoProjectId = mockStore.getProjects()[0].id;
    mockStore.addTask({
      content: "My own task",
      project_id: demoProjectId,
      is_completed: false,
    });

    const stripped = stripDemoData(readGuestData());

    expect(stripped.projects.map((p) => p.id)).toEqual([demoProjectId]);
  });

  it("leaves a blob with no demo items untouched", () => {
    mockStore.clearData();
    const own = mockStore.addTask({
      content: "My own task",
      is_completed: false,
    });

    const stripped = stripDemoData(readGuestData());

    expect(stripped.tasks.map((t) => t.id)).toEqual([own.id]);
  });
});

// A Loop Habit Tracker import writes thousands of entries at once. Saving on
// every entry is quadratic, and a swallowed quota error loses data silently
// while the UI reports success.
describe("MockStore bulk habit entry writes", () => {
  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists a bulk insert with a single write", () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    setItem.mockClear(); // discard the write from clearData() in beforeEach
    mockStore.addHabitEntries(makeEntries(2033));

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(mockStore.getHabitEntries()).toHaveLength(2033);
  });

  it("round-trips a bulk insert through localStorage", () => {
    mockStore.addHabitEntries(makeEntries(500));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.habit_entries).toHaveLength(500);
  });

  it("throws instead of silently losing data when storage is full", () => {
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    expect(() => mockStore.addHabitEntries(makeEntries(10))).toThrow(
      /storage/i,
    );
  });

  // Guest writes reach storage from ~30 call sites; only the uhabits import
  // reports failures itself. Reporting here covers the rest.
  it("reports a failed write to Sentry", () => {
    vi.mocked(Sentry.captureException).mockClear();
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("exceeded the quota", "QuotaExceededError");
    });

    expect(() => mockStore.addHabitEntries(makeEntries(10))).toThrow();

    expect(Sentry.captureException).toHaveBeenCalledOnce();
    const [reported] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect((reported as DOMException).name).toBe("QuotaExceededError");
  });
});
