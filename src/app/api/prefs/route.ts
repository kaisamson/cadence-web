import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { getPrefs, savePrefs } from "@/lib/prefs";
import { isPursuitArray, type Pursuit } from "@/lib/pursuits";

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getPrefs());
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!isPursuitArray(body?.pursuits)) {
    return NextResponse.json({ error: "Invalid pursuits" }, { status: 400 });
  }

  const pursuits = (body.pursuits as Pursuit[]).slice(0, 12).map((p: Pursuit) => ({
    id: p.id.slice(0, 40),
    name: p.name.trim().slice(0, 40),
    keywords: p.keywords
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 12),
  }));

  try {
    await savePrefs({ pursuits });
    return NextResponse.json({ pursuits });
  } catch (err) {
    // Supabase errors are plain objects, so String(err) yields "[object Object]".
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : "Could not save pursuits";
    console.error("prefs POST error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
