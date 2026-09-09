"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  createBackupZip,
  parseBackupZip,
  downloadBackup,
} from "@/lib/backup/export-import";
import { collectCloudBackup } from "@/lib/backup/cloud-data";
import { notify } from "@/lib/notify";

export function useAccountData() {
  const { user } = useAuth();
  const supabase = createClient();

  const exportData = async () => {
    if (!user) {
      notify.error("You must be logged in to export cloud data");
      return;
    }

    const promise = async () => {
      const data = await collectCloudBackup(supabase);

      const blob = await createBackupZip(data);
      downloadBackup(blob);

      return data;
    };

    return notify.promise(promise(), {
      loading: "Preparing your data export...",
      success: "Data exported successfully",
      error: (err) => `Export failed: ${err.message}`,
    });
  };

  const importData = async (file: File) => {
    if (!user) {
      notify.error("You must be logged in to import cloud data");
      return;
    }

    const promise = async () => {
      const data = await parseBackupZip(file);

      if (!data.metadata || !data.tasks) {
        throw new Error("Invalid backup file format: missing essential data");
      }

      // Remap IDs to attach imported rows to current user and preserve relationships without collisions.
      const idMap = new Map<string, string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remapAndPrepare = (items: any[], type: string) => {
        return items.map((item) => {
          const newId = crypto.randomUUID();
          idMap.set(item.id, newId);

          const newItem = { ...item, id: newId };

          // habit_entries is scoped through habit_id and has no user_id column.
          if (type !== "habit_entries") {
            newItem.user_id = user.id;
          }

          if (type === "tasks" && item.project_id) {
            newItem.project_id = idMap.get(item.project_id) || item.project_id;
          }
          if (type === "habit_entries" && item.habit_id) {
            newItem.habit_id = idMap.get(item.habit_id) || item.habit_id;
          }

          return newItem;
        });
      };

      // Insert parents first to satisfy foreign key constraints.
      if (data.projects && data.projects.length > 0) {
        const prepared = remapAndPrepare(data.projects, "projects");
        const { error } = await supabase.from("projects").insert(prepared);
        if (error) throw error;
      }

      if (data.habits && data.habits.length > 0) {
        const prepared = remapAndPrepare(data.habits, "habits");
        const { error } = await supabase.from("habits").insert(prepared);
        if (error) throw error;
      }

      const remaining = [
        { table: "tasks", items: data.tasks },
        { table: "habit_entries", items: data.habit_entries },
        { table: "focus_logs", items: data.focus_logs },
        { table: "calendar_events", items: data.events },
      ];

      for (const { table, items } of remaining) {
        if (items && items.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prepared = remapAndPrepare(items as any[], table);
          const { error } = await supabase.from(table).insert(prepared);
          if (error) {
            // Retry row-by-row on ics_uid conflict so one duplicate does not abort the restore.
            if (table === "calendar_events" && error.code === "23505") {
              for (const row of prepared) {
                const { error: rowError } = await supabase
                  .from(table)
                  .insert(row);
                if (rowError && rowError.code !== "23505") throw rowError;
              }
            } else {
              throw error;
            }
          }
        }
      }

      return data;
    };

    return notify.promise(promise(), {
      loading: "Importing your cloud data...",
      success: "Data imported successfully. Please refresh to see changes.",
      error: (err) => `Import failed: ${err.message}`,
    });
  };

  const clearCloudData = async () => {
    if (!user) return;

    const promise = async () => {
      const tables = [
        "tasks",
        "projects",
        "habits",
        "focus_logs",
        "calendar_events",
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", user.id);

        if (error) {
          console.error(`Clear error on table ${table}:`, error);
          throw error;
        }
      }
    };

    return notify.promise(promise(), {
      loading: "Clearing your cloud data...",
      success: "Cloud data cleared successfully",
      error: (err) => `Clear failed: ${err.message}`,
    });
  };

  return {
    exportData,
    importData,
    clearCloudData,
  };
}
