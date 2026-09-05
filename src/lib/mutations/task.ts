import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import { calculateNextDueDate } from "@/lib/utils/recurrence";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/lib/types/task";

function toRestorePayload(task: Task) {
  return {
    id: task.id,
    user_id: task.user_id,
    project_id: task.project_id,
    parent_id: task.parent_id,
    content: task.content,
    description: task.description,
    priority: task.priority,
    due_date: task.due_date,
    do_date: task.do_date,
    is_evening: task.is_evening,
    is_completed: task.is_completed,
    completed_at: task.completed_at,
    day_order: task.day_order,
    recurrence: task.recurrence,
    google_event_id: task.google_event_id,
    google_etag: task.google_etag,
  };
}

// Duplicated tasks strip recurrence so occurrences cannot rejoin a source series.
function toDuplicatePayload(task: Task, parentId: string | null) {
  return {
    content: task.content,
    description: task.description || null,
    priority: task.priority || 4,
    due_date: task.due_date || null,
    do_date: task.do_date || null,
    is_evening: task.is_evening || false,
    project_id: task.project_id || null,
    parent_id: parentId,
    recurrence: null,
    recurring_series_id: null,
    is_completed: false,
    completed_at: null,
    google_event_id: null,
    google_etag: null,
  };
}

export const taskMutations = {
  create: async (
    input: CreateTaskInput & { _clientId?: string },
  ): Promise<Task> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      // mockStore defaults day_order to append at the end.
      return mockStore.addTask({
        id: input._clientId,
        content: input.content,
        description: input.description || null,
        priority: input.priority || 4,
        due_date: input.due_date || null,
        do_date: input.do_date || null,
        is_evening: input.is_evening || false,
        project_id: input.project_id || null,
        parent_id: input.parent_id || null,
        recurrence: input.recurrence || null,
        recurring_series_id: input.recurrence ? crypto.randomUUID() : null,
        is_completed: false,
        completed_at: null,
        google_event_id: null,
        google_etag: null,
      });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const taskId = input._clientId || crypto.randomUUID();
    const seriesId = input.recurrence ? crypto.randomUUID() : null;

    // DB column defaults to 0; append at bottom to avoid tying at the top.
    const { data: lastTask } = await supabase
      .from("tasks")
      .select("day_order")
      .eq("user_id", user.id)
      .order("day_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextDayOrder = (lastTask?.day_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        id: taskId,
        user_id: user.id,
        content: input.content,
        description: input.description || null,
        priority: input.priority || 4,
        due_date: input.due_date || null,
        do_date: input.do_date || null,
        is_evening: input.is_evening || false,
        project_id: input.project_id || null,
        parent_id: input.parent_id || null,
        recurrence: input.recurrence || null,
        recurring_series_id: seriesId,
        day_order: nextDayOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Task;
  },

  toggle: async ({
    id,
    is_completed,
  }: {
    id: string;
    is_completed: boolean;
  }): Promise<{ task: Task; newRecurringTask?: Task }> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const updatedTask = mockStore.updateTask(id, {
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null,
      });

      if (!updatedTask) throw new Error("Task not found");

      if (is_completed) {
        mockStore.addFocusLog({
          user_id: "guest",
          task_id: id,
          start_time: new Date(Date.now() - 25 * 60000).toISOString(),
          end_time: new Date().toISOString(),
          duration_seconds: 25 * 60,
        });
      }

      let newRecurringTask: Task | undefined;
      let recurrenceRule = updatedTask.recurrence;
      if (typeof recurrenceRule === "string") {
        try {
          recurrenceRule = JSON.parse(recurrenceRule);
        } catch {
          recurrenceRule = null;
        }
      }

      if (is_completed && recurrenceRule) {
        const now = new Date();
        const nextDueDateIso = calculateNextDueDate(
          now,
          recurrenceRule,
          updatedTask.due_date,
        ).toISOString();
        const nextDoDateIso = updatedTask.do_date
          ? calculateNextDueDate(
              now,
              recurrenceRule,
              updatedTask.do_date,
            ).toISOString()
          : null;

        // Self-heal: generate series id if parent lacks one (legacy row)
        let seriesId = updatedTask.recurring_series_id;
        if (!seriesId) {
          seriesId = crypto.randomUUID();
          mockStore.updateTask(id, { recurring_series_id: seriesId });
          updatedTask.recurring_series_id = seriesId;
        }

        const alreadyExists = mockStore
          .getTasks()
          .some(
            (t) =>
              t.content === updatedTask.content &&
              t.project_id === updatedTask.project_id &&
              t.due_date === nextDueDateIso &&
              !t.is_completed,
          );

        if (!alreadyExists) {
          newRecurringTask = mockStore.addTask({
            project_id: updatedTask.project_id,
            content: updatedTask.content,
            description: updatedTask.description,
            priority: updatedTask.priority,
            due_date: nextDueDateIso,
            do_date: nextDoDateIso,
            is_evening: updatedTask.is_evening || false,
            recurrence: recurrenceRule,
            recurring_series_id: seriesId,
            is_completed: false,
            completed_at: null,
            google_event_id: null,
            google_etag: null,
            parent_id: null,
          } as Task);
        }
      }

      return { task: updatedTask, newRecurringTask };
    }

    const supabase = createClient();
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { data, error } = await supabase
      .from("tasks")
      .update({
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const updatedTask = data as Task;
    let newRecurringTask: Task | undefined;

    let recurrenceRule = currentTask.recurrence;
    if (typeof recurrenceRule === "string") {
      try {
        recurrenceRule = JSON.parse(recurrenceRule);
      } catch {
        recurrenceRule = null;
      }
    }

    if (is_completed && recurrenceRule) {
      // Do not copy ciphertext into the next occurrence if read while locked.
      if (isCiphertext(currentTask.content)) {
        throw new Error(
          "Cannot generate the next recurring Occurrence: content encryption key is unavailable (locked, or not yet unlocked on this device).",
        );
      }

      const now = new Date();
      const nextDueDateIso = calculateNextDueDate(
        now,
        recurrenceRule,
        currentTask.due_date,
      ).toISOString();
      const nextDoDateIso = currentTask.do_date
        ? calculateNextDueDate(
            now,
            recurrenceRule,
            currentTask.do_date,
          ).toISOString()
        : null;

      // Self-heal: generate series id if parent lacks one (legacy row)
      let seriesId = currentTask.recurring_series_id;
      if (!seriesId) {
        seriesId = crypto.randomUUID();
        await supabase
          .from("tasks")
          .update({ recurring_series_id: seriesId })
          .eq("id", id);
      }

      // `content` is encrypted at rest and matched client-side after decryption.
      // eslint-disable-next-line local/no-unbounded-supabase-select -- four equality filters incl. an exact due_date
      const existingTasks = await supabase
        .from("tasks")
        .select("id, content")
        .eq("user_id", currentTask.user_id)
        .eq("project_id", currentTask.project_id)
        .eq("due_date", nextDueDateIso)
        .eq("is_completed", false);

      const hasDuplicate = existingTasks.data?.some(
        (t) => t.content === currentTask.content,
      );

      if (!hasDuplicate) {
        // DB column defaults to 0; append at bottom to avoid tying at the top.
        const { data: lastTask } = await supabase
          .from("tasks")
          .select("day_order")
          .eq("user_id", currentTask.user_id)
          .order("day_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextDayOrder = (lastTask?.day_order ?? -1) + 1;

        const { data: newTask, error: createError } = await supabase
          .from("tasks")
          .insert({
            user_id: currentTask.user_id,
            project_id: currentTask.project_id,
            content: currentTask.content,
            description: currentTask.description,
            priority: currentTask.priority,
            due_date: nextDueDateIso,
            do_date: nextDoDateIso,
            is_evening: currentTask.is_evening || false,
            recurrence: recurrenceRule,
            recurring_series_id: seriesId,
            is_completed: false,
            day_order: nextDayOrder,
          })
          .select()
          .single();

        if (!createError) {
          newRecurringTask = newTask as Task;
        }
      }
    }

    return { task: updatedTask, newRecurringTask };
  },

  update: async (input: UpdateTaskInput): Promise<Task> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { id, ...updates } = input;

    if (isGuest) {
      const existing = mockStore.getTask(id);
      if (!existing) throw new Error("Task not found");

      if (updates.recurrence && !existing.recurring_series_id) {
        updates.recurring_series_id = crypto.randomUUID();
      }

      const result = mockStore.updateTask(id, updates);
      if (!result) throw new Error("Task not found");
      return result;
    }

    const supabase = createClient();

    if (updates.recurrence) {
      const { data: current, error: fetchError } = await supabase
        .from("tasks")
        .select("recurring_series_id")
        .eq("id", id)
        .single();

      if (fetchError) throw new Error(fetchError.message);
      if (!current) throw new Error("Task not found");

      if (!current.recurring_series_id) {
        updates.recurring_series_id = crypto.randomUUID();
      }
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Task;
  },

  // tasks.parent_id cascades in DB; returns deleted subtasks for undo restore.
  delete: async (id: string): Promise<Task[]> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      // mockStore doesn't cascade delete, so subtasks are not lost.
      mockStore.deleteTask(id);
      return [];
    }

    const supabase = createClient();

    // eslint-disable-next-line local/no-unbounded-supabase-select -- subtasks of one parent
    const { data: subtasks, error: subtasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("parent_id", id);
    if (subtasksError) throw new Error(subtasksError.message);

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return (subtasks as Task[]) ?? [];
  },

  // Parent is inserted before subtasks to satisfy foreign key constraints.
  restore: async (task: Task, subtasks: Task[] = []): Promise<void> => {
    const supabase = createClient();

    const { error } = await supabase
      .from("tasks")
      .insert(toRestorePayload(task));
    if (error) throw new Error(error.message);

    if (subtasks.length > 0) {
      const { error: subtasksError } = await supabase
        .from("tasks")
        .insert(subtasks.map(toRestorePayload));
      if (subtasksError) throw new Error(subtasksError.message);
    }
  },

  // Accepts slot-swapped day_orders (not sequential indices) to preserve sort order across groups.
  reorder: async (
    pairs: { id: string; day_order: number }[],
  ): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      pairs.forEach(({ id, day_order }) => {
        mockStore.updateTask(id, { day_order });
      });
      return;
    }

    const supabase = createClient();

    for (const { id, day_order } of pairs) {
      const { error } = await supabase
        .from("tasks")
        .update({ day_order })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
  },

  clearCompleted: async (): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const completedTasks = mockStore.getTasks().filter((t) => t.is_completed);
      completedTasks.forEach((t) => mockStore.deleteTask(t.id));
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", user.id)
      .eq("is_completed", true);

    if (error) throw new Error(error.message);
  },

  duplicate: async (
    sourceTask: Task,
    overrides?: Partial<Task>,
  ): Promise<Task> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      const duplicatedTask = mockStore.addTask({
        ...toDuplicatePayload(sourceTask, sourceTask.parent_id || null),
        ...overrides,
      });

      const duplicateSubtasksRecursively = (
        originalParentId: string,
        newParentId: string,
      ) => {
        for (const subtask of mockStore.getSubtasks(originalParentId)) {
          const newSubtask = mockStore.addTask(
            toDuplicatePayload(subtask, newParentId),
          );
          duplicateSubtasksRecursively(subtask.id, newSubtask.id);
        }
      };

      duplicateSubtasksRecursively(sourceTask.id, duplicatedTask.id);

      return duplicatedTask;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { data: lastTask } = await supabase
      .from("tasks")
      .select("day_order")
      .eq("user_id", user.id)
      .order("day_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextDayOrder = (lastTask?.day_order ?? -1) + 1;

    const { data: duplicatedTask, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        ...toDuplicatePayload(sourceTask, sourceTask.parent_id || null),
        ...overrides,
        day_order: nextDayOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const duplicateSubtasksRecursively = async (
      originalParentId: string,
      newParentId: string,
    ) => {
      // eslint-disable-next-line local/no-unbounded-supabase-select -- subtasks of one parent
      const { data: subtasks, error: subtasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", originalParentId);

      if (subtasksError) throw new Error(subtasksError.message);
      if (!subtasks || subtasks.length === 0) return;

      for (const subtask of subtasks) {
        const { data: newSubtask, error: insertError } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            ...toDuplicatePayload(subtask, newParentId),
            day_order: subtask.day_order ?? 0,
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        await duplicateSubtasksRecursively(subtask.id, newSubtask.id);
      }
    };

    await duplicateSubtasksRecursively(sourceTask.id, duplicatedTask.id);

    return duplicatedTask as Task;
  },
};
