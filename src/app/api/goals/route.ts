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
  if (!(await requireDashAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!OWNER_ID) {
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("goals")
    .select("id, text, is_done, created_at")
    .eq("user_id", OWNER_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await requireDashAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!OWNER_ID) {
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();

  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("goals")
    .insert({ user_id: OWNER_ID, text, is_done: false })
    .select("id, text, is_done, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}
