// app/api/days/[id]/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { getDayById, isUuid } from "@/lib/days";

const OWNER_ID = process.env.OWNER_ID;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid day id" }, { status: 400 });
  }

  try {
    const day = await getDayById(id);
    if (!day) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }
    return NextResponse.json(day);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("day detail error", err);
    return NextResponse.json({ error: "Internal error", details: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid day id" }, { status: 400 });
  }

  if (!OWNER_ID) {
    return NextResponse.json(
      { error: "OWNER_ID not set" },
      { status: 500 }
    );
  }

  try {
    // 1) Make sure this day belongs to you
    const { data: day, error: dayError } = await supabaseAdmin
      .from("days")
      .select("id")
      .eq("id", id)
      .eq("user_id", OWNER_ID)
      .maybeSingle();

    if (dayError) {
      console.error("DELETE day – select error", dayError);
      return NextResponse.json(
        { error: "Failed to load day" },
        { status: 500 }
      );
    }

    if (!day) {
      return NextResponse.json(
        { error: "Day not found" },
        { status: 404 }
      );
    }

    // 2) Delete child rows first to satisfy FKs

    // 2a) Events for this day
    const { error: eventsError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("day_id", id)
      .eq("user_id", OWNER_ID);

    if (eventsError) {
      console.error("DELETE day – events error", eventsError);
      return NextResponse.json(
        { error: "Failed to delete events" },
        { status: 500 }
      );
    }

    // 2a.5) Clear metrics_id on the day so FK doesn't block deleting metrics
    const { error: clearMetricsLinkError } = await supabaseAdmin
      .from("days")
      .update({ metrics_id: null })
      .eq("id", id)
      .eq("user_id", OWNER_ID);

    if (clearMetricsLinkError) {
      console.error("DELETE day – clear metrics link error", clearMetricsLinkError);
      return NextResponse.json(
        { error: "Failed to clear metrics link" },
        { status: 500 }
      );
    }

    // 2b) Metrics for this day
    const { error: metricsError } = await supabaseAdmin
      .from("metrics")
      .delete()
      .eq("day_id", id);

    if (metricsError) {
      console.error("DELETE day – metrics error", metricsError);
      return NextResponse.json(
        { error: "Failed to delete metrics" },
        { status: 500 }
      );
    }


    // 3) Delete the day itself
    const { error: dayDeleteError } = await supabaseAdmin
      .from("days")
      .delete()
      .eq("id", id)
      .eq("user_id", OWNER_ID);

    if (dayDeleteError) {
      console.error("DELETE day – days error", dayDeleteError);
      return NextResponse.json(
        { error: "Failed to delete day" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/days/[id] unexpected", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
