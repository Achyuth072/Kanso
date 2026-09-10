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

// Tracks per-item progress across attempts so a retry after a partial failure
// resumes instead of either re-uploading (duplicates) or being mistaken by
// the existing-content check below for an already-used account.
const PROGRESS_STORAGE_KEY = "kanso_migration_progress_v1";

interface MigrationProgress {
  projectIdMap: Record<string, string>;
  habitIdMap: Record<string, string>;
  taskIdMap: Record<string, string>;
  habitEntriesDone: boolean;
  eventsDone: boolean;
  focusLogsDone: boolean;
}

function emptyProgress(): MigrationProgress {
  return {
    projectIdMap: {},
    habitIdMap: {},
    taskIdMap: {},
    habitEntriesDone: false,
    eventsDone: false,
    focusLogsDone: false,
  };
}

function loadProgress(): MigrationProgress | null {
  const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MigrationProgress;
  } catch {
    return null;
  }
}

function saveProgress(progress: MigrationProgress): void {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

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
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
      document.cookie = "kanso_guest_mode=; path=/; max-age=0";
      return;
    }

    migrationInProgress.current = true;

    try {
      setIsMigrating(true);

      // A saved progress record proves any existing content below is ours from
      // a previous (partial) attempt, not a genuinely pre-used account.
      const existingProgress = loadProgress();
      const isResuming = existingProgress !== null;
      const progress: MigrationProgress = existingProgress ?? emptyProgress();

      // eslint-disable-next-line local/no-unbounded-supabase-select -- project definitions, not tasks
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id, name, is_inbox")
        .eq("user_id", user.id);

      if (!isResuming) {
        // Demo projects are stripped above, so project count alone can't signal an established account.
        const hasManualProject =
          userProjects?.some((p) => !p.is_inbox) ?? false;

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

        saveProgress(progress);
      }

      const projectMap = new Map<string, string>();
      const taskMap = new Map<string, string>();
      const habitMap = new Map<string, string>();

      if (guestData.projects && guestData.projects.length > 0) {
        for (const project of guestData.projects) {
          const migrated = progress.projectIdMap[project.id];
          if (migrated) {
            projectMap.set(project.id, migrated);
            continue;
          }

          const existing = userProjects?.find(
            (p) => p.name === project.name || (p.is_inbox && project.is_inbox),
          );

          if (existing) {
            projectMap.set(project.id, existing.id);
            progress.projectIdMap[project.id] = existing.id;
            saveProgress(progress);
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
          progress.projectIdMap[project.id] = newProject.id;
          saveProgress(progress);
        }
      }

      if (guestData.habits && guestData.habits.length > 0) {
        // eslint-disable-next-line local/no-unbounded-supabase-select -- habit definitions, not entries
        const { data: existingHabits } = await supabase
          .from("habits")
          .select("id, name")
          .eq("user_id", user.id);

        for (const habit of guestData.habits) {
          const migrated = progress.habitIdMap[habit.id];
          if (migrated) {
            habitMap.set(habit.id, migrated);
            continue;
          }

          const existing = existingHabits?.find((h) => h.name === habit.name);
          if (existing) {
            habitMap.set(habit.id, existing.id);
            progress.habitIdMap[habit.id] = existing.id;
            saveProgress(progress);
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
          progress.habitIdMap[habit.id] = newHabit.id;
          saveProgress(progress);
        }
      }

      if (guestData.tasks && guestData.tasks.length > 0) {
        for (const t of guestData.tasks) {
          const migrated = progress.taskIdMap[t.id];
          if (migrated) taskMap.set(t.id, migrated);
        }

        const pendingTasks = guestData.tasks.filter(
          (t) => !progress.taskIdMap[t.id],
        );

        if (pendingTasks.length > 0) {
          const tasksToInsert = pendingTasks.map((t) => ({
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

          // A single bulk insert returns rows in insertion order, so pairing
          // positionally is safe and — unlike matching on content+created_at —
          // can't be fooled by two guest tasks that happen to share both.
          pendingTasks.forEach((t: Task, i: number) => {
            const newTask = newTasks[i] as { id: string };
            taskMap.set(t.id, newTask.id);
            progress.taskIdMap[t.id] = newTask.id;
          });
          saveProgress(progress);
        }

        // Subtasks require parent_id, known only after parents are inserted;
        // re-running this UPDATE on a retry is harmless (idempotent).
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

      if (!progress.habitEntriesDone) {
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
        progress.habitEntriesDone = true;
        saveProgress(progress);
      }

      if (!progress.eventsDone) {
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
        progress.eventsDone = true;
        saveProgress(progress);
      }

      if (!progress.focusLogsDone) {
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
        progress.focusLogsDone = true;
        saveProgress(progress);
      }

      localStorage.removeItem("kanso_guest_mode");
      localStorage.removeItem(GUEST_DATA_STORAGE_KEY);
      localStorage.removeItem(PROGRESS_STORAGE_KEY);
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
