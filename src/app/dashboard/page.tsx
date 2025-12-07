// app/dashboard/page.tsx
export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

const OWNER_ID = process.env.OWNER_ID!;

type MetricsRow = {
  productive_hours: number | null;
  neutral_hours: number | null;
  wasted_hours: number | null;
  sleep_hours: number | null;
  focus_blocks: number | null;
  context_switches: number | null;
};

type DayRow = {
  id: string;
  date: string;
  summary: string | null;
  suggestions: string[] | null;
  created_at: string;
  metrics: MetricsRow | null;
};

async function getDays(): Promise<DayRow[]> {
  if (!OWNER_ID) {
    throw new Error("OWNER_ID not set");
  }

  const { data, error } = await supabaseAdmin
    .from("days")
    .select(
      `
      id,
      date,
      summary,
      suggestions,
      created_at,
      metrics:metrics_id (
        productive_hours,
        neutral_hours,
        wasted_hours,
        sleep_hours,
        focus_blocks,
        context_switches
      )
    `
    )
    .eq("user_id", OWNER_ID)
    .order("date", { ascending: false });

  if (error) {
    console.error("getDays error", error);
    throw error;
  }

  const rows = (data ?? []) as any[];

  const normalized: DayRow[] = rows.map((row) => {
    const rawMetrics = row.metrics;
    const metrics = Array.isArray(rawMetrics)
      ? rawMetrics[0] ?? null
      : rawMetrics ?? null;

    return {
      id: row.id,
      date: row.date,
      summary: row.summary,
      suggestions: row.suggestions,
      created_at: row.created_at,
      metrics,
    };
  });

  return normalized;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatHours(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(1)}h`;
}

export default async function DashboardPage() {
  const days = await getDays();

  const latest = days[0];
  const totalProductive = days.reduce(
    (sum, d) => sum + (d.metrics?.productive_hours ?? 0),
    0
  );
  const totalWasted = days.reduce(
    (sum, d) => sum + (d.metrics?.wasted_hours ?? 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadence Dashboard</h1>
            <p className="text-sm text-slate-400">
              Your analyzed days, metrics, and optimization suggestions.
            </p>
          </div>

          <div className="flex gap-3 text-sm">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-emerald-300/80">
                Total productive
              </div>
              <div className="text-lg font-semibold">
                {totalProductive.toFixed(1)}h
              </div>
            </div>
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-red-300/80">
                Total wasted
              </div>
              <div className="text-lg font-semibold">
                {totalWasted.toFixed(1)}h
              </div>
            </div>
          </div>
        </header>

        {latest && (
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-300">
              Latest day – {formatDate(latest.date)}
            </h2>
            <p className="mt-2 text-sm text-slate-200">
              {latest.summary ?? "No summary available."}
            </p>
            {latest.suggestions && latest.suggestions.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Suggestions
                </h3>
                <ul className="mt-1 space-y-1 text-sm text-slate-200">
                  {latest.suggestions.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-300">History</h2>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Summary</th>
                  <th className="px-4 py-2">Productive</th>
                  <th className="px-4 py-2">Wasted</th>
                  <th className="px-4 py-2">Sleep</th>
                  <th className="px-4 py-2">Focus blocks</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr
                    key={d.id}
                    className="border-t border-slate-800/80 hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-2 align-top">
                    <Link
                        href={`/day/${d.date}`} // 👈 use date as slug now
                        className="font-medium text-emerald-300 hover:text-emerald-200"
                    >
                        {formatDate(d.date)}
                    </Link>
                    <div className="text-xs text-slate-500">
                        {new Date(d.created_at).toLocaleTimeString("en-CA", {
                        hour: "2-digit",
                        minute: "2-digit",
                        })}
                    </div>
                    </td>

                    <td className="px-4 py-2 align-top max-w-xs">
                      <div className="line-clamp-3 text-slate-200">
                        {d.summary ?? "No summary"}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatHours(d.metrics?.productive_hours)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatHours(d.metrics?.wasted_hours)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {formatHours(d.metrics?.sleep_hours)}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {d.metrics?.focus_blocks ?? "-"}
                    </td>
                  </tr>
                ))}

                {days.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No days analyzed yet. Go to the home page and analyze
                      your first day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
