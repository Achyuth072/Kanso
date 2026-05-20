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

    const { subscription } = await request.json();

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription is required" },
        { status: 400 },
      );
    }

    const endpoint = subscription?.endpoint;
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "Subscription endpoint is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );

    if (error) {
      console.error("Error saving subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
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

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const endpoint = new URL(request.url).searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json(
        { error: "Subscription endpoint is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Error removing subscription:", error);
      return NextResponse.json(
        { error: "Failed to remove subscription" },
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
