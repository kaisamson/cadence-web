// app/api/goals/reorder/route.ts
//
// One request for a whole reorder. The previous implementation fired a separate
// PATCH per goal on every drag, so a 10-goal list meant 10 round trips that
// could land out of order.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { isUuid } from "@/lib/days";

const OWNER_ID = process.env.OWNER_ID!;

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Expected a non-empty ids array" }, { status: 400 });
  }
  if (!ids.every((id): id is string => typeof id === "string" && isUuid(id))) {
    return NextResponse.json({ error: "Invalid goal id in list" }, { status: 400 });
  }

  // Scope the write to this user's goals so a foreign id can't be reordered in.
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("goals")
    .select("id")
    .eq("user_id", OWNER_ID)
    .in("id", ids);

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  const ownedIds = new Set((owned ?? []).map((g) => g.id as string));
  const updates = ids
    .filter((id) => ownedIds.has(id))
    .map((id, index) =>
      supabaseAdmin
        .from("goals")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", OWNER_ID)
    );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: updates.length });
}
