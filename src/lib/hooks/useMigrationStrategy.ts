import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { trackSignupCompleted } from "@/lib/telemetry/client";
import {
  STORAGE_KEY as GUEST_DATA_STORAGE_KEY,
  stripDemoData,
  type GuestData,
} from "@/lib/mock/mock-store";
import type { Task } from "@/lib/types/task";

function hasRealContent(data: GuestData): boolean {
  return (
    (data.tasks?.length ?? 0) > 0 ||
    (data.habits?.length ?? 0) > 0 ||
    (data.projects?.length ?? 0) > 0 ||
    (data.events?.length ?? 0) > 0 ||
    (data.habit_entries?.length ?? 0) > 0 ||
    (data.focus_logs?.length ?? 0) > 0
  );
}

export function useMigrationStrategy() {
  const { user, isGuestMode } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const migrationInProgress = useRef(false);
  const supabase = createClient();

  const migrate = useCallback(async () => {
    if (
      !user ||
      user.id === "guest" ||
      isGuestMode ||
      migrationInProgress.current
    ) {
      return;
    }

    // AuthProvider clears kanso_guest_mode on session detection before this hook runs.
    const guestDataStr = localStorage.getItem(GUEST_DATA_STORAGE_KEY);

    if (!guestDataStr) {
      return;
    }

    // Prevents fabricated history from becoming the user's real streaks/scores. See ADR 0014.
    const guestData = stripDemoData(JSON.parse(guestDataStr) as GuestData);

    // Avoid reload loop: mock-store re-seeds demo data on every load.
    if (!hasRealContent(guestData)) {
      localStorage.removeItem("kanso_guest_mode");
      document.cookie = "kanso_guest_mode=; path=/; max-age=0";
      return;
    }

    migrationInProgress.current = true;

    try {
      setIsMigrating(true);
      // eslint-disable-next-line local/no-unbounded-supabase-select -- project definitions, not tasks
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id, name, is_inbox")
        .eq("user_id", user.id);

      // Demo projects are stripped above, so project count alone can't signal an established account.
      const hasManualProject = userProjects?.some((p) => !p.is_inbox) ?? false;

      const [{ count: existingTaskCount }, { count: existingHabitCount }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("habits")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
        ]);

      const hasExistingContent =
        hasManualProject ||
        (existingTaskCount ?? 0) > 0 ||
        (existingHabitCount ?? 0) > 0;

      if (hasExistingContent) {
        localStorage.removeItem("kanso_guest_mode");
        localStorage.removeItem(GUEST_DATA_STORAGE_KEY);
        document.cookie = "kanso_guest_mode=; path=/; max-age=0";
        setIsMigrating(false);
        return;
      }

      const projectMap = new Map<string, string>();
      const taskMap = new Map<string, string>();
      const habitMap = new Map<string, string>();

      if (guestData.projects && guestData.projects.length > 0) {
        for (const project of guestData.projects) {
          const existing = userProjects?.find(
            (p) => p.name === project.name || (p.is_inbox && project.is_inbox),
          );

          if (existing) {
            projectMap.set(project.id, existing.id);
            continue;
          }

          const { data: newProject, error } = await supabase
            .from("projects")
            .insert({
              user_id: user.id,
              name: project.name,
              color: project.color,
              view_style: project.view_style,
              is_inbox: project.is_inbox,
              is_archived: project.is_archived,
              created_at: project.created_at,
              updated_at: project.updated_at,
            })
            .select()
            .single();

          if (error) throw error;
          projectMap.set(project.id, newProject.id);
        }
      }

      if (guestData.habits && guestData.habits.length > 0) {
        // eslint-disable-next-line local/no-unbounded-supabase-select -- habit definitions, not entries
        const { data: existingHabits } = await supabase
          .from("habits")
          .select("id, name")
          .eq("user_id", user.id);

        for (const habit of guestData.habits) {
          const existing = existingHabits?.find((h) => h.name === habit.name);
          if (existing) {
            habitMap.set(habit.id, existing.id);
            continue;
          }

          const { data: newHabit, error } = await supabase
            .from("habits")
            .insert({
              user_id: user.id,
              name: habit.name,
              description: habit.description,
              color: habit.color,
              icon: habit.icon,
              start_date: habit.start_date,
              created_at: habit.created_at,
              updated_at: habit.updated_at,
              archived_at: habit.archived_at,
            })
            .select()
            .single();

          if (error) throw error;
          habitMap.set(habit.id, newHabit.id);
        }
      }

      if (guestData.tasks && guestData.tasks.length > 0) {
        const tasksToInsert = guestData.tasks.map((t) => ({
          user_id: user.id,
          project_id: t.project_id ? projectMap.get(t.project_id) : null,
          content: t.content,
          description: t.description,
          priority: t.priority,
          due_date: t.due_date,
          do_date: t.do_date,
          is_evening: t.is_evening,
          is_completed: t.is_completed,
          completed_at: t.completed_at,
          day_order: t.day_order,
          recurrence: t.recurrence,
          google_event_id: t.google_event_id,
          google_etag: t.google_etag,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }));

        const { data: newTasks, error } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();

        if (error) throw error;

        // Match back by content+created_at because insert doesn't preserve client guest ID.
        newTasks.forEach(
          (nt: { id: string; content: string; created_at: string }) => {
            const original = guestData.tasks.find(
              (ot: Task) =>
                ot.content === nt.content && ot.created_at === nt.created_at,
            );
            if (original) {
              taskMap.set(original.id, nt.id);
            }
          },
        );

        // Subtasks require parent_id which is only known after parents are inserted.
        const subtasks = guestData.tasks.filter((t) => t.parent_id !== null);
        for (const st of subtasks) {
          if (!st.parent_id) continue;
          const newTaskId = taskMap.get(st.id);
          const newParentId = taskMap.get(st.parent_id);
          if (newTaskId && newParentId) {
            await supabase
              .from("tasks")
              .update({ parent_id: newParentId })
              .eq("id", newTaskId);
          }
        }
      }

      if (guestData.habit_entries && guestData.habit_entries.length > 0) {
        const entriesToInsert = guestData.habit_entries
          .map((e) => {
            const newHabitId = habitMap.get(e.habit_id);
            if (!newHabitId) return null;
            return {
              habit_id: newHabitId,
              date: e.date,
              value: e.value,
              created_at: e.created_at,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null);

        if (entriesToInsert.length > 0) {
          const { error } = await supabase
            .from("habit_entries")
            .insert(entriesToInsert);
          if (error) throw error;
        }
      }

      if (guestData.events && guestData.events.length > 0) {
        // Skip synced external events to prevent FK violations with guest-local
        // calendar IDs; they are re-synced when the user reconnects the calendar.
        const eventsToInsert = guestData.events
          .filter((e) => !e.remote_calendar_id)
          .map((e) => ({
            user_id: user.id,
            title: e.title,
            description: e.description,
            location: e.location,
            start_time: e.start_time,
            end_time: e.end_time,
            all_day: e.all_day,
            color: e.color,
            category: e.category,
            recurrence_rule: e.recurrence_rule,
            metadata: e.metadata,
            is_archived: e.is_archived,
            created_at: e.created_at,
            updated_at: e.updated_at,
          }));

        if (eventsToInsert.length > 0) {
          const { error } = await supabase
            .from("calendar_events")
            .insert(eventsToInsert);
          if (error) throw error;
        }
      }

      if (guestData.focus_logs && guestData.focus_logs.length > 0) {
        const logsToInsert = guestData.focus_logs.map((l) => ({
          user_id: user.id,
          task_id: l.task_id ? taskMap.get(l.task_id) : null,
          start_time: l.start_time,
          end_time: l.end_time,
          duration_seconds: l.duration_seconds,
          created_at: l.created_at,
        }));

        const { error } = await supabase
          .from("focus_logs")
          .insert(logsToInsert);
        if (error) throw error;
      }

      localStorage.removeItem("kanso_guest_mode");
      localStorage.removeItem(GUEST_DATA_STORAGE_KEY);
      document.cookie = "kanso_guest_mode=; path=/; max-age=0";

      notify.success(
        "Synchronization complete! Your data is safe in the cloud. Demo content wasn't carried over.",
      );

      trackSignupCompleted();

      window.location.reload();
    } catch (err: unknown) {
      console.error("Migration fatal error:", err);
      notify.error(
        "Sync interrupted. We'll try again automatically on next reload.",
      );
    } finally {
      setIsMigrating(false);
      migrationInProgress.current = false;
    }
  }, [user, isGuestMode, supabase]);

  useEffect(() => {
    const hasGuestData = localStorage.getItem(GUEST_DATA_STORAGE_KEY) !== null;
    if (user && user.id !== "guest" && !isGuestMode && hasGuestData) {
      migrate();
    }
  }, [user, isGuestMode, migrate]);

  return { isMigrating };
}
