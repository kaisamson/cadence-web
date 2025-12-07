import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID!;

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

    return NextResponse.json(data ?? []);
  } catch (err: any) {
    console.error("days GET error", err);
    return NextResponse.json(
      { error: "Internal error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
