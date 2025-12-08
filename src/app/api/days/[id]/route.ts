// app/api/days/[id]/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuthorized } from "@/lib/apiAuth";

const OWNER_ID = process.env.OWNER_ID;

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyRequestAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OWNER_ID) {
      return NextResponse.json(
        { error: "OWNER_ID not set" },
        { status: 500 }
      );
    }

    const { id } = await context.params;
    const dayId = id;

    if (!dayId) {
      return NextResponse.json(
        { error: "Missing day id" },
        { status: 400 }
      );
    }

    if (!isUuid(dayId)) {
      return NextResponse.json(
        { error: "Invalid day id" },
        { status: 400 }
      );
    }

    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("days")
      .select(
        `
        id,
        date,
        transcript,
        summary,
        suggestions,
        metrics:metrics_id (
          productive_hours,
          neutral_hours,
          wasted_hours,
          sleep_hours,
          focus_blocks,
          context_switches
        )
      `
      )
      .eq("id", dayId)
      .eq("user_id", OWNER_ID)
      .maybeSingle();

    if (dayError) {
      console.error("day detail select error", dayError);
      throw dayError;
    }

    if (!dayRow) {
      return NextResponse.json(
        { error: "Day not found" },
        { status: 404 }
      );
    }

    const rawDay = dayRow as {
      id: string;
      date: string;
      transcript: string;
      summary: string | null;
      suggestions: string[] | null;
      metrics:
        | null
        | {
            productive_hours: number | null;
            neutral_hours: number | null;
            wasted_hours: number | null;
            sleep_hours: number | null;
            focus_blocks: number | null;
            context_switches: number | null;
          }
        | any[];
    };

    const rawMetrics = rawDay.metrics;
    const metrics =
      Array.isArray(rawMetrics) ? rawMetrics[0] ?? null : rawMetrics ?? null;

    const { data: eventRows, error: eventsError } = await supabaseAdmin
      .from("events")
      .select(
        `
        id,
        label,
        category,
        start_time,
        end_time,
        notes
      `
      )
      .eq("day_id", dayId)
      .eq("user_id", OWNER_ID)
      .order("start_time", { ascending: true });

    if (eventsError) {
      console.error("events select error", eventsError);
      throw eventsError;
    }

    const events =
      (eventRows ?? []).map((e) => ({
        id: e.id as string,
        label: e.label as string,
        category: e.category as string,
        startTime: (e.start_time as string | null) ?? null,
        endTime: (e.end_time as string | null) ?? null,
        notes: (e.notes as string | null) ?? null,
      })) ?? [];

    const response = {
      id: rawDay.id,
      date: rawDay.date,
      transcript: rawDay.transcript,
      summary: rawDay.summary,
      suggestions: rawDay.suggestions ?? [],
      metrics: metrics
        ? {
            productiveHours: Number(metrics.productive_hours ?? 0),
            neutralHours: Number(metrics.neutral_hours ?? 0),
            wastedHours: Number(metrics.wasted_hours ?? 0),
            sleepHours: Number(metrics.sleep_hours ?? 0),
            focusBlocks: Number(metrics.focus_blocks ?? 0),
            contextSwitches: Number(metrics.context_switches ?? 0),
          }
        : null,
      events,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as any).message)
        : String(err);

    console.error("day detail error", err);
    return NextResponse.json(
      {
        error: "Internal error",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;  // ← FIXED


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
