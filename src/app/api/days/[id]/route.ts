import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID!;

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    if (!OWNER_ID) {
      return NextResponse.json(
        { error: "OWNER_ID not set" },
        { status: 500 }
      );
    }

    const dayId = context.params.id;

    // 1) Fetch day + metrics
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

    const rawMetrics = dayRow.metrics;
    const metrics = Array.isArray(rawMetrics)
      ? rawMetrics[0] ?? null
      : rawMetrics ?? null;

    // 2) Fetch events
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

    const events = (eventRows ?? []).map((e) => ({
      id: e.id,
      label: e.label,
      category: e.category,
      startTime: e.start_time,
      endTime: e.end_time,
      notes: e.notes,
    }));

    // 3) Shape response similar to DayAnalysis
    const response = {
      id: dayRow.id,
      date: dayRow.date,
      transcript: dayRow.transcript,
      summary: dayRow.summary,
      suggestions: dayRow.suggestions ?? [],
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

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("day detail error", err);
    return NextResponse.json(
      {
        error: "Internal error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
