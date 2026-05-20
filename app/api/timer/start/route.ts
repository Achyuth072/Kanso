import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { duration, taskId, mode } = await request.json();

    if (!duration || typeof duration !== "number" || duration <= 0) {
      return NextResponse.json(
        { error: "Valid positive duration is required" },
        { status: 400 },
      );
    }

    // 1. Fetch task content if taskId is provided for better notification message
    let taskContent = "";
    if (taskId) {
      const { data: task } = await supabase
        .from("tasks")
        .select("content")
        .eq("id", taskId)
        .single();
      if (task) {
        taskContent = task.content;
      }
    }

    // Check user settings for timer alerts
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    const settings = profile?.settings || {};
    const timerAlertsEnabled = settings.notifications?.timer_alerts ?? true;

    if (!timerAlertsEnabled) {
      return NextResponse.json({
        message: "Timer started, but notifications are disabled in settings",
        id: null,
      });
    }

    // Determine notification content based on mode and task
    const title = mode === "focus" ? "Focus Complete 🎯" : "Break Complete ☕";
    const body = taskContent
      ? `Finished your "${taskContent}" session. Great work!`
      : mode === "focus"
        ? "Your focus session is complete. Take a break!"
        : "Your break is over. Time to focus!";

    // 3. Calculate scheduled time
    const scheduledAt = new Date(Date.now() + duration * 1000).toISOString();

    // 4. Insert into notification queue
    const { data, error } = await supabase
      .from("notification_queue")
      .insert({
        user_id: user.id,
        scheduled_at: scheduledAt,
        type: "timer_end",
        payload: {
          title,
          body,
          data: { url: "/focus", taskId },
        },
        reference_id: taskId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error scheduling notification:", error);
      return NextResponse.json(
        { error: "Failed to schedule notification" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      notificationId: data.id,
      scheduledAt,
    });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = await request.json();

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 },
      );
    }

    // Cancel the notification
    const { error } = await supabase
      .from("notification_queue")
      .update({ status: "cancelled" })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error cancelling notification:", error);
      return NextResponse.json(
        { error: "Failed to cancel notification" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
