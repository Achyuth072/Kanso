import { createClient } from "@/lib/supabase/client";
import { mockStore } from "@/lib/mock/mock-store";

export interface LogFocusSessionInput {
  task_id: string;
  durationSeconds: number;
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
};
