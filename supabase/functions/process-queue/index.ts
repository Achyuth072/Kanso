import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const publicVapidKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateVapidKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");

    if (!publicVapidKey || !privateVapidKey || !vapidSubject) {
      throw new Error("VAPID configuration missing in environment variables");
    }

    webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);

    const results = { sent: 0, failed: 0, skipped: 0, polls: 0 };
    const startTime = Date.now();
    const MAX_RUNTIME = 50000; // Run for up to 50 seconds
    const POLL_INTERVAL = 5000; // Poll every 5 seconds

    while (Date.now() - startTime < MAX_RUNTIME) {
      results.polls++;

      // 1. Fetch pending notifications
      const { data: queue, error: queueError } = await supabaseAdmin
        .from("notification_queue")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .limit(50);

      if (queueError) throw queueError;

      if (queue && queue.length > 0) {
        // 2. Process each notification
        for (const item of queue) {
          try {
            // Get all subscriptions for the user (multi-device/domain support)
            const { data: subData, error: subError } = await supabaseAdmin
              .from("push_subscriptions")
              .select("id, subscription")
              .eq("user_id", item.user_id);

            if (subError || !subData || subData.length === 0) {
              await supabaseAdmin
                .from("notification_queue")
                .update({
                  status: "failed",
                  error_message: "User subscription not found",
                })
                .eq("id", item.id);
              results.skipped++;
              continue;
            }

            const payload = JSON.stringify({
              title: item.payload?.title || "Kanso",
              body: item.payload?.body || "Notification",
              data: item.payload?.data || {},
            });

            let sent = 0;
            let failed = 0;

            for (const sub of subData) {
              try {
                await webpush.sendNotification(sub.subscription, payload);
                sent++;
              } catch (error) {
                failed++;
                const statusCode = error.statusCode;
                if (statusCode === 410 || statusCode === 404) {
                  await supabaseAdmin
                    .from("push_subscriptions")
                    .delete()
                    .eq("id", sub.id);
                }
                console.error(
                  `Error sending notification ${item.id} to subscription ${sub.id}:`,
                  error,
                );
              }
            }

            if (sent === 0) {
              await supabaseAdmin
                .from("notification_queue")
                .update({
                  status: "failed",
                  error_message:
                    failed > 0
                      ? "Failed to deliver to all subscriptions"
                      : "User subscription not found",
                })
                .eq("id", item.id);

              results.failed++;
              continue;
            }

            await supabaseAdmin
              .from("notification_queue")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", item.id);

            results.sent++;
          } catch (error) {
            console.error(`Error sending notification ${item.id}:`, error);

            await supabaseAdmin
              .from("notification_queue")
              .update({ status: "failed", error_message: error.message })
              .eq("id", item.id);
            results.failed++;
          }
        }
      }

      // If we still have time, wait for the next poll
      const timeElapsed = Date.now() - startTime;
      if (timeElapsed + POLL_INTERVAL < MAX_RUNTIME) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      } else {
        break;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Critical error in process-queue:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
