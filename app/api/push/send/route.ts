import { createClient } from "@/lib/supabase/server";
import { webpush } from "@/lib/push";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      throw new Error("VAPID configuration missing");
    }

    const { userId, endpoint, title, body, data } = await request.json();
    const targetUserId = userId || currentUser.id;

    let subscriptionsQuery = supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", targetUserId);

    if (endpoint) {
      subscriptionsQuery = subscriptionsQuery.eq("endpoint", endpoint);
    }

    const { data: subscriptions, error: subError } = await subscriptionsQuery;

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        {
          error: endpoint
            ? "Requested subscription not found"
            : "User not subscribed or subscription not found",
        },
        { status: 404 },
      );
    }

    const payload = JSON.stringify({
      title: title || "Kanso",
      body: body || "New notification",
      data: data || {},
    });

    console.log(
      `[Push Send] Attempting to send to ${subscriptions.length} subscriptions for user ${targetUserId}`,
    );
    console.log(`[Push Send] Payload:`, payload);

    let sentCount = 0;
    let failedCount = 0;
    let failedStatusCode: number | null = null;

    for (const sub of subscriptions) {
      try {
        console.log(
          `[Push Send] Sending to endpoint: ${sub.subscription.endpoint}`,
        );
        const result = await webpush.sendNotification(
          sub.subscription as unknown as webpush.PushSubscription,
          payload,
          {
            TTL: 60,
            urgency: "high",
            topic: "test-notification",
          },
        );
        console.log(
          `[Push Send] Success for endpoint: ${sub.subscription.endpoint}`,
          result.statusCode,
        );
        sentCount++;
      } catch (error: unknown) {
        failedCount++;
        console.error("[Push Send] Web Push Error:", error);

        const pushError = error as { statusCode?: number };
        if (
          pushError.statusCode === 410 ||
          pushError.statusCode === 404 ||
          failedStatusCode === null
        ) {
          failedStatusCode = pushError.statusCode ?? 500;
        }

        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);

          if (deleteError) {
            console.error("Error deleting expired subscription:", deleteError);
          }
        }
      }
    }

    if (sentCount === 0) {
      const status =
        failedStatusCode === 404 || failedStatusCode === 410
          ? failedStatusCode
          : failedCount > 0
            ? 500
            : 404;

      return NextResponse.json(
        {
          error:
            status === 404 || status === 410
              ? "Subscription expired or not found. Re-enable notifications on this device."
              : "Failed to send push notification",
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      endpointMatched: Boolean(endpoint),
    });
  } catch (error: unknown) {
    console.error("Internal Server Error:", error);

    let message = "Internal Server Error";
    if (
      error instanceof Error &&
      error.message === "VAPID configuration missing"
    ) {
      message = error.message;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
