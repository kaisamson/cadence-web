// app/api/days/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID;

export async function GET(_req: NextRequest) {
  try {
    if (!OWNER_ID) {
      return NextResponse.json(
        { error: "OWNER_ID not set" },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("days")
      .select(
        `
        id,
        date,
        summary,
        suggestions,
        created_at,
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
      .eq("user_id", OWNER_ID)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching days", error);
      throw error;
    }

    const rows = (data ?? []) as any[];

    const shaped = rows.map((row) => {
      const rawMetrics = row.metrics;
      const metrics = Array.isArray(rawMetrics)
        ? rawMetrics[0] ?? null
        : rawMetrics ?? null;

      return {
        id: row.id as string,
        date: row.date as string,
        summary: (row.summary as string | null) ?? null,
        suggestions: (row.suggestions as string[] | null) ?? [],
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
      };
    });

    return NextResponse.json(shaped, { status: 200 });
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as any).message)
        : String(err);

    console.error("days GET error", err);
    return NextResponse.json(
      { error: "Internal error", details: message },
      { status: 500 }
    );
  }
}
