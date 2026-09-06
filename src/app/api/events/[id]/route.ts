// app/api/events/[id]/route.ts
//
// Direct edits to a single event. Without this, correcting one mislabelled
// block meant re-describing the whole day to the model and hoping.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { syncDayMetrics } from "@/lib/metricsSync";
import { isUuid } from "@/lib/days";
import { hhmm } from "@/lib/time";

const OWNER_ID = process.env.OWNER_ID!;

const VALID_CATEGORIES = new Set([
  "productive",
  "neutral",
  "waste",
  "sleep",
  "untracked",
]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (typeof body?.label === "string") {
    const label = body.label.trim().slice(0, 120);
    if (!label) return NextResponse.json({ error: "Label cannot be empty" }, { status: 400 });
    patch.label = label;
  }

  if (typeof body?.category === "string") {
    const category = body.category.trim().toLowerCase();
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    patch.category = category;
  }

  if (body?.startTime !== undefined) {
    const t = hhmm(body.startTime);
    if (!t) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    patch.start_time = t;
  }

  if (body?.endTime !== undefined) {
    const t = hhmm(body.endTime);
    if (!t) return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    patch.end_time = t;
  }

  if (body?.notes !== undefined) {
    patch.notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, 280)
        : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Validate the resulting span against whichever side isn't being changed.
  const { data: current, error: readError } = await supabaseAdmin
    .from("events")
    .select("day_id, start_time, end_time")
    .eq("id", id)
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const nextStart = (patch.start_time as string) ?? hhmm(current.start_time as string);
  const nextEnd = (patch.end_time as string) ?? hhmm(current.end_time as string);
  if (nextStart && nextEnd && nextStart >= nextEnd) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("events")
    .update(patch)
    .eq("id", id)
    .eq("user_id", OWNER_ID)
    .select("id, label, category, start_time, end_time, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncDayMetrics(current.day_id as string);

  return NextResponse.json({ event: data });
}

export async function DELETE(req: NextRequest, context: Ctx) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from("events")
    .select("day_id")
    .eq("id", id)
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (!current) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncDayMetrics(current.day_id as string);

  return NextResponse.json({ ok: true });
}
