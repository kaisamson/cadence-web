// lib/prefs.ts
//
// Small user-preferences blob.
//
// Lives in dashboard_prefs. The column was originally `pinned_metrics`, from the
// removed metric-pinning feature, and is being renamed to `prefs`:
//
//   alter table dashboard_prefs rename column pinned_metrics to prefs;
//
// The column is resolved at runtime rather than assumed, so this code is correct
// both before and after that statement runs — the rename can be applied without
// coordinating it with a deploy.
//
// It is a text[], so each pursuit is stored as one JSON string. Writing a bare
// object to it fails with "expected JSON array".

import { supabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_PURSUITS, isPursuitArray, type Pursuit } from "./pursuits";

const OWNER_ID = process.env.OWNER_ID!;

const PREFERRED_COLUMN = "prefs";
const LEGACY_COLUMN = "pinned_metrics";

/** Cached so the fallback probe runs at most once per server instance. */
let resolvedColumn: string | null = null;

/** Postgres "undefined column" — the rename simply hasn't been applied yet. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

async function getColumn(): Promise<string> {
  if (resolvedColumn) return resolvedColumn;

  const { error } = await supabaseAdmin
    .from("dashboard_prefs")
    .select(PREFERRED_COLUMN)
    .limit(1);

  resolvedColumn = isMissingColumn(error) ? LEGACY_COLUMN : PREFERRED_COLUMN;
  return resolvedColumn;
}

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

  const column = await getColumn();

  const { data, error } = await supabaseAdmin
    .from("dashboard_prefs")
    .select(column)
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (error) {
    console.error("getPrefs error", error);
    return { pursuits: DEFAULT_PURSUITS };
  }

  const row = data as Record<string, unknown> | null;
  return { pursuits: parsePursuits(row?.[column]) };
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  const column = await getColumn();

  const { error } = await supabaseAdmin.from("dashboard_prefs").upsert(
    {
      user_id: OWNER_ID,
      [column]: prefs.pursuits.map((p) => JSON.stringify(p)),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}
