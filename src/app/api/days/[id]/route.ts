// app/api/days/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID;

type RouteContext = {
  params: {
    id: string;
  };
};

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    if (!OWNER_ID) {
      return NextResponse.json(
        { error: "OWNER_ID not set" },
        { status: 500 }
      );
    }

    const dayId = context.params?.id;

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

    const rawDay = dayRow as {
      id: string;
      date: string;
      transcript: string;
      summary: string | null;
      suggestions: string[] | null;
      metrics: null | {
        productive_hours: number | null;
        neutral_hours: number | null;
        wasted_hours: number | null;
        sleep_hours: number | null;
        focus_blocks: number | null;
        context_switches: number | null;
      } | Array<any>;
    };

    const rawMetrics = rawDay.metrics;
    const metrics =
      Array.isArray(rawMetrics) ? rawMetrics[0] ?? null : rawMetrics ?? null;

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

    const events =
      (eventRows ?? []).map((e) => ({
        id: e.id as string,
        label: e.label as string,
        category: e.category as string,
        startTime: (e.start_time as string | null) ?? null,
        endTime: (e.end_time as string | null) ?? null,
        notes: (e.notes as string | null) ?? null,
      })) ?? [];

    // 3) Shape response similar to DayAnalysis
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
