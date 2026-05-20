import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";

interface FocusLog {
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  created_at: string;
}

interface GuestData {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  focus_logs: FocusLog[];
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

    const guestModeActive = localStorage.getItem("kanso_guest_mode") === "true";
    const guestDataStr = localStorage.getItem("kanso_guest_data_v7");

    // If no guest mode flag OR no data to migrate, just cleanup and exit
    if (!guestModeActive || !guestDataStr) {
      if (guestModeActive) {
        localStorage.removeItem("kanso_guest_mode");
        document.cookie = "kanso_guest_mode=; path=/; max-age=0";
      }
      return;
    }

    migrationInProgress.current = true;

    try {
      setIsMigrating(true);
      const guestData = JSON.parse(guestDataStr) as GuestData;

      // Check for existing user data to avoid duplicate migrations
      // We look for any non-inbox projects as a signal that migration already happened
      const { data: userProjects } = await supabase
        .from("projects")
        .select("id, name, is_inbox")
        .eq("user_id", user.id);

      const hasMigratedBefore = userProjects && userProjects.length > 1;

      if (hasMigratedBefore) {
        localStorage.removeItem("kanso_guest_mode");
        localStorage.removeItem("kanso_guest_data_v7");
        document.cookie = "kanso_guest_mode=; path=/; max-age=0";
        setIsMigrating(false);
        return;
      }

      // Maps to track ID transitions
      const projectMap = new Map<string, string>();
      const taskMap = new Map<string, string>();
      const habitMap = new Map<string, string>();

      // 1. Migrate Projects
      if (guestData.projects && guestData.projects.length > 0) {
        for (const project of guestData.projects) {
          // Find existing project by name + is_inbox to avoid duplicates
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

      // 2. Migrate Habits
      if (guestData.habits && guestData.habits.length > 0) {
        // Check for existing habits
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

      // 3. Migrate Tasks (First pass: create tasks without parent_id)
      if (guestData.tasks && guestData.tasks.length > 0) {
        const tasksToInsert = guestData.tasks.map((t: Task) => ({
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

        // Batch insert
        const { data: newTasks, error } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();

        if (error) throw error;

        // Map content+created_at to new IDs for subtask linkage
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

        // Second pass: Update parent_id for subtasks
        const subtasks = guestData.tasks.filter(
          (t: Task) => t.parent_id !== null,
        );
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

      // 4. Migrate Habit Entries
      if (guestData.habit_entries && guestData.habit_entries.length > 0) {
        const entriesToInsert = guestData.habit_entries
          .map((e: HabitEntry) => {
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

      // 5. Migrate Focus Logs
      if (guestData.focus_logs && guestData.focus_logs.length > 0) {
        const logsToInsert = guestData.focus_logs.map((l: FocusLog) => ({
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

      // SUCCESS: Clear Guest Data
      localStorage.removeItem("kanso_guest_mode");
      localStorage.removeItem("kanso_guest_data_v7");
      document.cookie = "kanso_guest_mode=; path=/; max-age=0";

      toast.success(
        "Synchronization complete! Your data is safe in the cloud.",
      );

      // Reload to refresh all application state with real data
      window.location.reload();
    } catch (err: unknown) {
      console.error("Migration fatal error:", err);
      toast.error(
        "Sync interrupted. We'll try again automatically on next reload.",
      );
    } finally {
      setIsMigrating(false);
      migrationInProgress.current = false;
    }
  }, [user, isGuestMode, supabase]);

  useEffect(() => {
    const guestMode = localStorage.getItem("kanso_guest_mode") === "true";
    if (user && user.id !== "guest" && !isGuestMode && guestMode) {
      migrate();
    }
  }, [user, isGuestMode, migrate]);

  return { isMigrating };
}
