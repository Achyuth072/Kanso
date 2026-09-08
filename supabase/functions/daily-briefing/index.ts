import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toErrorMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Morning briefing runs at 8 AM, evening plan at 6 PM (scheduler-side).
    const { data: morningUsers, error: morningError } = await supabaseAdmin.rpc(
      "get_users_for_morning_briefing",
    );
    const { data: eveningUsers, error: eveningError } = await supabaseAdmin.rpc(
      "get_users_for_evening_plan",
    );

    if (morningError)
      console.error("Morning Briefing RPC error:", morningError);
    if (eveningError) console.error("Evening Plan RPC error:", eveningError);

    const results = { morning_scheduled: 0, evening_scheduled: 0 };

    if (morningUsers && morningUsers.length > 0) {
      for (const user of morningUsers) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("settings")
          .eq("id", user.id)
          .single();

        const isEnabled =
          profile?.settings?.notifications?.morning_briefing ?? true;
        if (!isEnabled) continue;

        const { count } = await supabaseAdmin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_completed", false)
          .filter("do_date", "gte", new Date().toISOString().split("T")[0]);

        const taskCount = count || 0;
        if (taskCount === 0) continue;

        const body =
          taskCount > 1
            ? `You have ${taskCount} tasks for today.`
            : `Ready for today? You have 1 task.`;

        await supabaseAdmin.from("notification_queue").insert({
          user_id: user.id,
          type: "briefing",
          scheduled_at: new Date().toISOString(),
          payload: {
            title: "Morning Briefing",
            body: body,
            data: { url: "/" },
          },
        });
        results.morning_scheduled++;
      }
    }

    if (eveningUsers && eveningUsers.length > 0) {
      for (const user of eveningUsers) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("settings")
          .eq("id", user.id)
          .single();

        const isEnabled =
          profile?.settings?.notifications?.evening_plan ?? true;
        if (!isEnabled) continue;

        const { data: eveningTasks } = await supabaseAdmin
          .from("tasks")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_completed", false)
          .eq("is_evening", true)
          .limit(5);

        const taskCount = eveningTasks?.length || 0;
        if (taskCount === 0) continue;

        const body = `You have ${taskCount} tasks set for tonight. Ready to wrap up?`;

        await supabaseAdmin.from("notification_queue").insert({
          user_id: user.id,
          type: "evening",
          scheduled_at: new Date().toISOString(),
          payload: {
            title: "Evening Plan",
            body: body,
            data: { url: "/" },
          },
        });
        results.evening_scheduled++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Critical error in daily-briefing:", error);
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
