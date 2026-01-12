import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID!;

async function requireDashAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get("cadence_auth");
  return auth?.value === "1";
}

export async function GET() {
  if (!(await requireDashAuth()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ID)
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("id, text, is_done, created_at, sort_order")
    .eq("user_id", OWNER_ID)
    // order by sort_order first, then created_at
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await requireDashAuth()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ID)
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  // find current max sort_order so new goals append to bottom
  const { data: maxRows } = await supabaseAdmin
    .from("goals")
    .select("sort_order")
    .eq("user_id", OWNER_ID)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1);

  const max = (maxRows?.[0]?.sort_order ?? -1) as number;
  const nextSort = max + 1;

  const { data, error } = await supabaseAdmin
    .from("goals")
    .insert({ user_id: OWNER_ID, text, is_done: false, sort_order: nextSort })
    .select("id, text, is_done, created_at, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}
