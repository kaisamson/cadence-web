import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OWNER_ID = process.env.OWNER_ID!;

async function requireDashAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get("cadence_auth");
  return auth?.value === "1";
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  if (!(await requireDashAuth()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ID)
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });

  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  const patch: { text?: string; is_done?: boolean; sort_order?: number } = {};

  if (body?.text != null) patch.text = String(body.text).trim();
  if (body?.is_done != null) patch.is_done = Boolean(body.is_done);
  if (body?.sort_order != null) patch.sort_order = Number(body.sort_order);

  if (patch.text === "")
    return NextResponse.json({ error: "Text cannot be empty" }, { status: 400 });
  if (patch.sort_order != null && Number.isNaN(patch.sort_order))
    return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("goals")
    .update(patch)
    .eq("id", id)
    .eq("user_id", OWNER_ID)
    .select("id, text, is_done, created_at, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ goal: data });
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  if (!(await requireDashAuth()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ID)
    return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });

  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
