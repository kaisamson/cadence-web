// app/api/days/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { getAllDays } from "@/lib/days";

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Metrics come from lib/days, so this endpoint reports the same derived
    // numbers the UI shows rather than the stale values in the metrics table.
    const days = await getAllDays();
    return NextResponse.json(days);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("days GET error", err);
    return NextResponse.json({ error: "Internal error", details: message }, { status: 500 });
  }
}
