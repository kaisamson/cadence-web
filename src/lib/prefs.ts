// lib/prefs.ts
//
// Small user-preferences blob.
//
// Lives in dashboard_prefs.prefs (renamed from pinned_metrics, a leftover from
// the removed metric-pinning feature — see supabase/migrations/0001).
//
// The column is a text[], so each pursuit is stored as one JSON string. Writing
// a bare object to it fails with "expected JSON array".

import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_PURSUITS, isPursuitArray, type Pursuit } from "./pursuits";

const OWNER_ID = process.env.OWNER_ID!;

export type Prefs = { pursuits: Pursuit[] };

function parsePursuits(raw: unknown): Pursuit[] {
  if (!Array.isArray(raw)) return DEFAULT_PURSUITS;

  const parsed = raw.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    try {
      return [JSON.parse(entry) as unknown];
    } catch {
      // Legacy metric-pin keys were plain strings, not JSON. Ignore them.
      return [];
    }
  });

  return isPursuitArray(parsed) ? parsed : DEFAULT_PURSUITS;
}

export async function getPrefs(): Promise<Prefs> {
  if (!OWNER_ID) return { pursuits: DEFAULT_PURSUITS };

  const { data, error } = await supabaseAdmin
    .from("dashboard_prefs")
    .select("prefs")
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (error) {
    console.error("getPrefs error", error);
    return { pursuits: DEFAULT_PURSUITS };
  }

  return { pursuits: parsePursuits(data?.prefs) };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  const { error } = await supabaseAdmin.from("dashboard_prefs").upsert(
    {
      user_id: OWNER_ID,
      prefs: prefs.pursuits.map((p) => JSON.stringify(p)),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}
