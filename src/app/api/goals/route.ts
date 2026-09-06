import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyRequestAuthorized } from "@/lib/apiAuth";

const OWNER_ID = process.env.OWNER_ID!;
const GOAL_COLUMNS = "id, text, is_done, created_at, sort_order";

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!OWNER_ID) {
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("user_id", OWNER_ID)
    .order("sort_order", { ascending: true, nullsFirst: false })
    // Oldest first as the tiebreak, so unordered goals keep the order they were added.
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!OWNER_ID) {
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim().slice(0, 200);
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const { data: maxRows } = await supabaseAdmin
    .from("goals")
    .select("sort_order")
    .eq("user_id", OWNER_ID)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1);

  const nextSort = ((maxRows?.[0]?.sort_order as number | null) ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("goals")
    .insert({ user_id: OWNER_ID, text, is_done: false, sort_order: nextSort })
    .select(GOAL_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}
