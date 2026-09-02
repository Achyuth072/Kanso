import { describe, it, expect, beforeEach, vi } from "vitest";
import { taskMutations } from "@/lib/mutations/task";
import { mockStore } from "@/lib/mock/mock-store";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext, encryptField } from "@/lib/crypto/contentCipher";
import {
  createFakeSupabaseClient,
  type Row,
} from "../../support/fakeSupabaseClient";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

const mockCreateClient = vi.mocked(createClient);

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

beforeEach(() => {
  localStorage.setItem("kanso_guest_mode", "true");
  mockStore.clearData();
});

describe("recurring_series_id", () => {
  describe("create", () => {
    it("stamps a recurring_series_id when recurrence is set", async () => {
      const task = await taskMutations.create({
        content: "Daily standup",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      expect(task.recurring_series_id).toBeDefined();
      expect(task.recurring_series_id).not.toBeNull();
    });

    it("leaves recurring_series_id null when no recurrence", async () => {
      const task = await taskMutations.create({
        content: "One-off task",
      });

      expect(task.recurring_series_id).toBeNull();
    });
  });

  describe("update", () => {
    it("stamps a recurring_series_id when adding recurrence to existing task", async () => {
      const task = await taskMutations.create({
        content: "Will become recurring",
      });

      expect(task.recurring_series_id).toBeNull();

      const updated = await taskMutations.update({
        id: task.id,
        recurrence: { freq: "WEEKLY", interval: 1 },
      });

      expect(updated.recurring_series_id).toBeDefined();
      expect(updated.recurring_series_id).not.toBeNull();
    });

    it("does not overwrite existing series id when recurrence already set", async () => {
      const task = await taskMutations.create({
        content: "Already recurring",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      const originalSeriesId = task.recurring_series_id;

      const updated = await taskMutations.update({
        id: task.id,
        content: "Renamed recurring",
      });

      expect(updated.recurring_series_id).toBe(originalSeriesId);
    });
  });

  describe("toggle", () => {
    it("carries recurring_series_id onto spawned Occurrence", async () => {
      const task = await taskMutations.create({
        content: "Weekly review",
        recurrence: { freq: "WEEKLY", interval: 1 },
      });

      const seriesId = task.recurring_series_id;
      expect(seriesId).not.toBeNull();

      const { newRecurringTask } = await taskMutations.toggle({
        id: task.id,
        is_completed: true,
      });

      expect(newRecurringTask).toBeDefined();
      expect(newRecurringTask!.recurring_series_id).toBe(seriesId);
    });

    it("self-heals when parent lacks series id", async () => {
      const task = await taskMutations.create({
        content: "Legacy recurring",
        recurrence: { freq: "DAILY", interval: 1 },
      });

      mockStore.updateTask(task.id, { recurring_series_id: null });

      const { task: updated, newRecurringTask } = await taskMutations.toggle({
        id: task.id,
        is_completed: true,
      });

      expect(updated.recurring_series_id).not.toBeNull();
      expect(newRecurringTask!.recurring_series_id).toBe(
        updated.recurring_series_id,
      );
    });
  });

  describe("toggle — authenticated (Supabase), with real encryption", () => {
    // mode: "strict" anchors to due_date rather than now for determinism.
    const recurrence = { freq: "WEEKLY", interval: 1, mode: "strict" };
    const dueDate = "2026-08-10T10:00:00.000Z";
    const nextDueDate = "2026-08-17T10:00:00.000Z";

    beforeEach(async () => {
      localStorage.removeItem("kanso_guest_mode");
      keyStoreState.key = await generateMasterKey();
    });

    function seedOriginalTask() {
      return {
        id: "t1",
        user_id: "u1",
        project_id: null,
        content: "Weekly review",
        description: null,
        priority: 4,
        due_date: dueDate,
        do_date: null,
        is_evening: false,
        is_completed: false,
        recurrence,
        recurring_series_id: "series-1",
        day_order: 0,
      };
    }

    it("creates the next Occurrence, storing its content as ciphertext, when none exists yet", async () => {
      const raw = createFakeSupabaseClient({ tasks: [seedOriginalTask()] });
      mockCreateClient.mockReturnValue(wrapSupabaseClient(raw, FIELD_MAP));
      raw.rawRows("tasks")[0].content = await encryptField(
        keyStoreState.key!,
        "Weekly review",
      );

      const { newRecurringTask } = await taskMutations.toggle({
        id: "t1",
        is_completed: true,
      });

      expect(newRecurringTask).toBeDefined();
      expect(newRecurringTask!.content).toBe("Weekly review");
      expect(newRecurringTask!.due_date).toBe(nextDueDate);

      const occurrence = raw
        .rawRows("tasks")
        .find((row: Row) => row.id !== "t1");
      expect(isCiphertext(occurrence.content)).toBe(true);
    });

    it("does not spawn a duplicate Occurrence that already exists for the next due date, even though content is ciphertext at rest", async () => {
      const existingOccurrence = {
        id: "t2",
        user_id: "u1",
        project_id: null,
        content: "placeholder — overwritten below",
        due_date: nextDueDate,
        is_completed: false,
      };
      const raw = createFakeSupabaseClient({
        tasks: [seedOriginalTask(), existingOccurrence],
      });
      mockCreateClient.mockReturnValue(wrapSupabaseClient(raw, FIELD_MAP));
      const key = keyStoreState.key!;
      raw.rawRows("tasks")[0].content = await encryptField(
        key,
        "Weekly review",
      );
      raw.rawRows("tasks")[1].content = await encryptField(
        key,
        "Weekly review",
      );

      const { newRecurringTask } = await taskMutations.toggle({
        id: "t1",
        is_completed: true,
      });

      expect(newRecurringTask).toBeUndefined();
      expect(raw.rawRows("tasks")).toHaveLength(2);
    });

    it("throws rather than spawning a bogus Occurrence when the master key is unavailable at read time", async () => {
      const raw = createFakeSupabaseClient({ tasks: [seedOriginalTask()] });
      mockCreateClient.mockReturnValue(wrapSupabaseClient(raw, FIELD_MAP));
      raw.rawRows("tasks")[0].content = await encryptField(
        keyStoreState.key!,
        "Weekly review",
      );
      keyStoreState.key = null;

      await expect(
        taskMutations.toggle({ id: "t1", is_completed: true }),
      ).rejects.toThrow("content encryption key is unavailable");

      expect(raw.rawRows("tasks")[0].is_completed).toBe(true);
      expect(raw.rawRows("tasks")).toHaveLength(1);
    });
  });
});
