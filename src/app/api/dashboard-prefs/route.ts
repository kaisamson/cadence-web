// app/api/dashboard-prefs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyRequestAuthorized } from "@/lib/apiAuth";

const OWNER_ID = process.env.OWNER_ID!;

export async function POST(req: NextRequest) {
  if (!verifyRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OWNER_ID) {
    return NextResponse.json(
      { error: "OWNER_ID not set" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const pinnedMetrics = Array.isArray(body.pinned_metrics)
      ? (body.pinned_metrics as string[])
      : [];

    const { data, error } = await supabaseAdmin
      .from("dashboard_prefs")
      .upsert(
        {
          user_id: OWNER_ID,
          pinned_metrics: pinnedMetrics,
        },
        { onConflict: "user_id" }
      )
      .select("pinned_metrics")
      .single();

    if (error) {
      console.error("dashboard-prefs upsert error", error);
      return NextResponse.json(
        { error: "Failed to save dashboard prefs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ pinned_metrics: data?.pinned_metrics ?? [] });
  } catch (err: any) {
    console.error("dashboard-prefs route error", err);
    return NextResponse.json(
      {
        error: "Internal error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
