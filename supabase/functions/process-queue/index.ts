import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";
import {
  buildSendOptions,
  isExpired,
  isGoneStatus,
  pushStatusCode,
  resolveFailure,
  type FailureResolution,
  type NotificationType,
} from "../_shared/push-delivery.ts";
import { describeError, toErrorMessage } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QueueRow {
  id: string;
  user_id: string;
  type: NotificationType;
  reference_id: string | null;
  retry_count: number;
  scheduled_at: string;
  payload: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  } | null;
}

interface Subscription {
  id: string;
  user_id: string;
  subscription: unknown;
}

serve(async (req: Request) => {
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

    const results = {
      sent: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
      expired: 0,
      polls: 0,
    };
    const startTime = Date.now();
    const MAX_RUNTIME = 50000;
    const POLL_INTERVAL = 1500;

    const queue = supabaseAdmin.from("notification_queue");

    const markFailed = async (id: string, message: string) => {
      await queue
        .update({ status: "failed", error_message: message })
        .eq("id", id);
    };

    const settle = async (
      id: string,
      resolution: FailureResolution,
      failMessage?: string,
    ) => {
      if (resolution.action === "retry") {
        await queue
          .update({
            status: "pending",
            retry_count: resolution.retryCount,
            next_attempt_at: resolution.nextAttemptAt,
            claimed_at: null,
          })
          .eq("id", id);
        results.retried++;
        return;
      }
      await markFailed(id, failMessage ?? resolution.errorMessage);
      results.failed++;
    };

    while (Date.now() - startTime < MAX_RUNTIME) {
      results.polls++;

      // Atomic claim so concurrent runs take disjoint batches.
      const { data: claimed, error: queueError } = await supabaseAdmin.rpc(
        "claim_due_notifications",
        { p_limit: 50 },
      );

      if (queueError) throw queueError;
      const batch = (claimed ?? []) as QueueRow[];

      // One lookup for the whole batch instead of one per row.
      const subsByUser = new Map<string, Subscription[]>();
      if (batch.length > 0) {
        // eslint-disable-next-line local/no-unbounded-supabase-select -- at most 50 claimed users x their devices
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, user_id, subscription")
          .in("user_id", [...new Set(batch.map((row) => row.user_id))]);

        for (const sub of (subs ?? []) as Subscription[]) {
          const existing = subsByUser.get(sub.user_id);
          if (existing) existing.push(sub);
          else subsByUser.set(sub.user_id, [sub]);
        }
      }

      for (const item of batch) {
        try {
          if (isExpired(item.type, item.scheduled_at)) {
            await markFailed(item.id, "expired before delivery");
            results.expired++;
            continue;
          }

          const subscriptions = subsByUser.get(item.user_id) ?? [];
          if (subscriptions.length === 0) {
            await markFailed(item.id, "User subscription not found");
            results.skipped++;
            continue;
          }

          const sendOptions = buildSendOptions(item.type, item.reference_id);
          const payload = JSON.stringify({
            title: item.payload?.title || "Kagelin",
            body: item.payload?.body || "Notification",
            data: item.payload?.data || {},
            // Reuse the Topic: what collapses in transit collapses in the tray.
            tag: sendOptions.topic,
          });

          const outcomes = await Promise.all(
            subscriptions.map(async (sub) => {
              try {
                await webpush.sendNotification(
                  sub.subscription,
                  payload,
                  sendOptions,
                );
                return { ok: true as const };
              } catch (error) {
                console.error(
                  `Error sending notification ${item.id} to subscription ${sub.id}:`,
                  error,
                );
                return {
                  ok: false as const,
                  id: sub.id,
                  statusCode: pushStatusCode(error),
                };
              }
            }),
          );

          const failures = outcomes.filter((o) => !o.ok);
          const goneIds = failures
            .filter((f) => isGoneStatus(f.statusCode))
            .map((f) => f.id);

          if (goneIds.length > 0) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .in("id", goneIds);
          }

          if (outcomes.length > failures.length) {
            await queue
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", item.id);
            results.sent++;
            continue;
          }

          await settle(
            item.id,
            resolveFailure(
              item.retry_count,
              failures.map((f) => f.statusCode),
            ),
          );
        } catch (error) {
          console.error(`Error sending notification ${item.id}:`, error);

          await settle(
            item.id,
            resolveFailure(item.retry_count, [undefined]),
            describeError(error),
          );
        }
      }

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
    return new Response(JSON.stringify({ error: toErrorMessage(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
