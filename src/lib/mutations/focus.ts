import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";

export interface LogFocusSessionInput {
  task_id: string;
  durationSeconds: number;
}

export interface UpsertTimerStateInput {
  user_id: string;
  mode: string;
  remaining_seconds: number;
  is_running: boolean;
  active_task_id: string | null;
  updated_at?: string;
}

export const focusMutations = {
  logSession: async (input: LogFocusSessionInput): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { task_id, durationSeconds } = input;

    if (isGuest) {
      mockStore.addFocusLog({
        task_id,
        user_id: "guest",
        start_time: new Date(Date.now() - durationSeconds * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: durationSeconds,
      });
      return;
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("focus_logs").insert({
      task_id,
      user_id: user.id,
      start_time: new Date(Date.now() - durationSeconds * 1000).toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: durationSeconds,
    });

    if (error) throw new Error(error.message);
  },

  upsertTimerState: async (input: UpsertTimerStateInput): Promise<void> => {
    const isGuest =
      typeof window !== "undefined" &&
      localStorage.getItem("kanso_guest_mode") === "true";
    const { user_id, mode, remaining_seconds, is_running, active_task_id } =
      input;

    if (isGuest) {
      return; // No-op for guest users
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("user_timer_state").upsert(
      {
        user_id,
        mode,
        remaining_seconds,
        is_running,
        active_task_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
  },
};
