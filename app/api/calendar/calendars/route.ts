import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { fetchAllRows } from "@/lib/supabase/paginate";

interface PickedCalendar {
  remote_calendar_id: string;
  name: string;
  color?: string;
}

export async function GET() {
  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  const admin = createAdminClient();
  // Service-role bypasses the decrypting wrapper: `name` is ciphertext here.
  // eslint-disable-next-line local/no-unbounded-supabase-select -- handful of calendars per user
  const { data, error } = await admin
    .from("external_calendars")
    .select("id, provider, name, remote_calendar_id, sync_enabled")
    .eq("user_id", user.id);

  if (error) {
    console.error("[calendar-calendars:GET] failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ calendars: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const provider = body.provider as string;
  const picks = (body.calendars ?? []) as PickedCalendar[];

  if (!provider || picks.length === 0) {
    return NextResponse.json(
      { error: "provider and calendars required" },
      { status: 400 },
    );
  }

  const { user, error: authError } = await requireUser();
  if (authError) return authError;

  const admin = createAdminClient();

  // eslint-disable-next-line local/no-unbounded-supabase-select -- handful of calendars per user
  const { data: existing } = await admin
    .from("external_calendars")
    .select("remote_calendar_id")
    .eq("user_id", user.id)
    .eq("provider", provider);
  const existingIds = new Set(
    (existing ?? []).map((r) => r.remote_calendar_id),
  );

  const rows = picks
    .filter((c) => !existingIds.has(c.remote_calendar_id))
    .map((c) => ({
      user_id: user.id,
      provider,
      // Already encrypted by connectCalendars — service-role writes skip the wrapper.
      name: c.name,
      color: c.color ?? "#4B6CB7",
      remote_calendar_id: c.remote_calendar_id,
      sync_direction: "bidirectional",
      sync_enabled: true,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  const { data, error } = await admin
    .from("external_calendars")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[calendar-calendars:POST] insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newCalendarIds = (data ?? []).map((r) => r.id);

  // Reconnect: unarchive orphaned events from previously deleted calendar connections.
  if (newCalendarIds.length > 0) {
    const [{ data: allCalendars }, archivedSynced] = await Promise.all([
      // eslint-disable-next-line local/no-unbounded-supabase-select -- handful of calendars per user
      admin.from("external_calendars").select("id").eq("user_id", user.id),
      // Best-effort adoption: failure should not fail calendar creation.
      fetchAllRows<{ id: string; remote_calendar_id: string }>((from, to) =>
        admin
          .from("calendar_events")
          .select("id, remote_calendar_id")
          .eq("user_id", user.id)
          .eq("is_archived", true)
          .not("remote_id", "is", null)
          .not("remote_calendar_id", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
      ).catch((scanError) => {
        console.error(
          "[calendar-calendars:POST] orphan scan failed; sync will revive:",
          scanError,
        );
        return [];
      }),
    ]);
    const activeIds = new Set((allCalendars ?? []).map((c) => c.id));

    const orphanIds = archivedSynced
      .filter((e) => !activeIds.has(e.remote_calendar_id))
      .map((e) => e.id);

    if (orphanIds.length > 0) {
      await admin
        .from("calendar_events")
        .update({ remote_calendar_id: newCalendarIds[0], is_archived: false })
        .in("id", orphanIds);
    }
  }

  return NextResponse.json({ created: data?.length ?? 0 });
}
