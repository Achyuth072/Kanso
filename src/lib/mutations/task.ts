import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";
import type { Task, CreateTaskInput, UpdateTaskInput } from "@/lib/types/task";

export const taskMutations = {
  create: async (
    input: CreateTaskInput & { _clientId?: string },
  ): Promise<Task> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
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
        is_completed: false,
        completed_at: null,
        day_order: 0,
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
        const { calculateNextDueDate } = await import("../utils/recurrence");
        const nextDueDate = calculateNextDueDate(
          new Date(),
          recurrenceRule,
          updatedTask.due_date,
        );
        const nextDueDateIso = nextDueDate.toISOString();

        // Prevent duplicate future instances in mock store
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
            do_date: updatedTask.do_date,
            is_evening: updatedTask.is_evening || false,
            recurrence: recurrenceRule,
            is_completed: false,
            completed_at: null,
            day_order: 0,
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
      const { calculateNextDueDate } = await import("../utils/recurrence");
      const nextDueDate = calculateNextDueDate(
        new Date(),
        recurrenceRule,
        currentTask.due_date,
      );
      const nextDueDateIso = nextDueDate.toISOString();

      // Prevent duplicate future instances if already created
      const existingTasks = await supabase
        .from("tasks")
        .select("id")
        .eq("user_id", currentTask.user_id)
        .eq("content", currentTask.content)
        .eq("project_id", currentTask.project_id)
        .eq("due_date", nextDueDateIso)
        .eq("is_completed", false);

      if (!existingTasks.data?.length) {
        const { data: newTask, error: createError } = await supabase
          .from("tasks")
          .insert({
            user_id: currentTask.user_id,
            project_id: currentTask.project_id,
            content: currentTask.content,
            description: currentTask.description,
            priority: currentTask.priority,
            due_date: nextDueDateIso,
            do_date: currentTask.do_date,
            is_evening: currentTask.is_evening || false,
            recurrence: recurrenceRule,
            is_completed: false,
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
      const result = mockStore.updateTask(id, updates);
      if (!result) throw new Error("Task not found");
      return result;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Task;
  },

  delete: async (id: string): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";

    if (isGuest) {
      mockStore.deleteTask(id);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  // Accepts pre-computed {id, day_order} pairs produced by the slot-value-swap
  // in useReorderTasks.onMutate. Each task receives the day_order value from
  // the cache slot it is moving into — not a fresh sequential 0,1,2... — so
  // the globally-sorted flat array remains stable across all sections/groups.
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
};
