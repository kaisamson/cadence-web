// app/day/[id]/page.tsx
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

type EventRow = {
  id: string;
  label: string;
  category: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type DayWithEvents = {
  id: string;
  date: string;
  transcript: string;
  summary: string | null;
  suggestions: string[] | null;
  metrics: MetricsRow | null;
  events: EventRow[];
};

async function getDay(id: string): Promise<DayWithEvents | null> {
  if (!OWNER_ID) throw new Error("OWNER_ID not set");

  // Fetch the day + metrics
  const { data: dayData, error: dayError } = await supabaseAdmin
    .from("days")
    .select(
      `
      id,
      date,
      transcript,
      summary,
      suggestions,
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
    .eq("id", id)
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (dayError) {
    console.error("getDay dayError", dayError);
    throw dayError;
  }

  if (!dayData) {
    return null;
  }

  const rawDay: any = dayData;

  // Normalize metrics (Supabase might return an array)
  const rawMetrics = rawDay.metrics;
  const metrics: MetricsRow | null = Array.isArray(rawMetrics)
    ? (rawMetrics[0] ?? null)
    : (rawMetrics ?? null);

  // Fetch events for this day
  const { data: eventsData, error: eventsError } = await supabaseAdmin
    .from("events")
    .select(
      `
      id,
      label,
      category,
      start_time,
      end_time,
      notes
    `
    )
    .eq("day_id", id)
    .eq("user_id", OWNER_ID)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("getDay eventsError", eventsError);
    throw eventsError;
  }

  const events: EventRow[] = (eventsData ?? []).map((e: any) => ({
    id: e.id,
    label: e.label,
    category: e.category,
    start_time: e.start_time,
    end_time: e.end_time,
    notes: e.notes,
  }));

  return {
    id: rawDay.id,
    date: rawDay.date,
    transcript: rawDay.transcript,
    summary: rawDay.summary,
    suggestions: rawDay.suggestions ?? [],
    metrics,
    events,
  };
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MetricCard(props: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
}) {
  const { label, value, suffix = "h" } = props;
  const display =
    value == null ? "-" : suffix ? `${value.toFixed(1)}${suffix}` : value;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-50">{display}</div>
    </div>
  );
}

export default async function DayDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const day = await getDay(params.id);

  if (!day) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to dashboard
          </Link>
          <p className="mt-4 text-slate-300">Day not found.</p>
        </div>
      </main>
    );
  }

  const metrics = day.metrics;
  const events = day.events;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold">
              Day detail – {formatDate(day.date)}
            </h1>
            <p className="text-xs text-slate-400">
              Full timeline, metrics, and recap.
            </p>
          </div>
        </header>

        {/* Summary & Suggestions */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-300">Summary</h2>
            <p className="mt-2 text-sm text-slate-100">
              {day.summary ?? "No summary available."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-slate-300">
              Suggestions
            </h2>
            {day.suggestions && day.suggestions.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-100">
                {day.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                No suggestions for this day.
              </p>
            )}
          </div>
        </section>

        {/* Metrics */}
        {metrics && (
          <section className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Productive" value={metrics.productive_hours} />
            <MetricCard label="Neutral" value={metrics.neutral_hours} />
            <MetricCard label="Wasted" value={metrics.wasted_hours} />
            <MetricCard label="Sleep" value={metrics.sleep_hours} />
            <MetricCard
              label="Focus blocks"
              value={metrics.focus_blocks}
              suffix=""
            />
            <MetricCard
              label="Context switches"
              value={metrics.context_switches}
              suffix=""
            />
          </section>
        )}

        {/* Timeline */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Timeline</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No events recorded.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e: EventRow) => (
                <div
                  key={e.id}
                  className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="w-24 shrink-0 text-xs text-slate-400">
                    {e.start_time && e.end_time
                      ? `${e.start_time.slice(0, 5)}–${e.end_time.slice(0, 5)}`
                      : "—"}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {e.label}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs capitalize text-slate-300">
                        {e.category}
                      </span>
                    </div>
                    {e.notes && (
                      <p className="text-xs text-slate-300">{e.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Raw transcript */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-300">
            Original recap transcript
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-xs text-slate-200">
            {day.transcript}
          </p>
        </section>
      </div>
    </main>
  );
}
