// lib/prefs.ts
//
// Small user-preferences blob.
//
// Stored in dashboard_prefs.pinned_metrics, a text[] that already exists. The
// column name is a leftover from the removed metric-pinning feature; reusing it
// keeps this migration-free. Each pursuit is one JSON string in the array, which
// is what a text[] can actually hold — writing a bare object to it fails with
// "expected JSON array".
//
// To tidy the naming later:
//   alter table dashboard_prefs rename column pinned_metrics to prefs;

import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_PURSUITS, isPursuitArray, type Pursuit } from "./pursuits";

const OWNER_ID = process.env.OWNER_ID!;

export type Prefs = { pursuits: Pursuit[] };

export async function getPrefs(): Promise<Prefs> {
  if (!OWNER_ID) return { pursuits: DEFAULT_PURSUITS };

  const { data, error } = await supabaseAdmin
    .from("dashboard_prefs")
    .select("pinned_metrics")
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (error) {
    console.error("getPrefs error", error);
    return { pursuits: DEFAULT_PURSUITS };
  }

  const raw = data?.pinned_metrics;
  if (!Array.isArray(raw)) return { pursuits: DEFAULT_PURSUITS };

  const parsed = raw.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    try {
      return [JSON.parse(entry) as unknown];
    } catch {
      // Legacy metric-pin keys were plain strings, not JSON. Ignore them.
      return [];
    }
  });

  return { pursuits: isPursuitArray(parsed) ? parsed : DEFAULT_PURSUITS };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  const { error } = await supabaseAdmin.from("dashboard_prefs").upsert(
    {
      user_id: OWNER_ID,
      pinned_metrics: prefs.pursuits.map((p) => JSON.stringify(p)),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}
