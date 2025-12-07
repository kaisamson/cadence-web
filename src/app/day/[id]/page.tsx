// app/day/[id]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Metrics = {
  productive_hours: number | null;
  neutral_hours: number | null;
  wasted_hours: number | null;
  sleep_hours: number | null;
  focus_blocks: number | null;
  context_switches: number | null;
};

type Event = {
  id: string;
  label: string;
  category: "productive" | "neutral" | "waste" | "sleep" | string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type DayDetail = {
  id: string;
  date: string; // YYYY-MM-DD
  transcript: string;
  summary: string | null;
  suggestions: string[] | null;
  metrics: Metrics | null;
  events: Event[];
};

// Basic UUID validation to avoid 22P02 errors from Postgres
function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

async function getDayById(id: string): Promise<DayDetail | null> {
  if (!id || id === "undefined") {
    console.warn("getDayById: missing or 'undefined' id");
    return null;
  }

  if (!isUuid(id)) {
    console.warn("getDayById: invalid UUID slug", id);
    return null;
  }

  // Fetch the day by primary key ONLY (no user_id filter)
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
    .maybeSingle();

  if (dayError) {
    console.error("getDayById dayError", dayError);
    return null;
  }

  if (!dayData) {
    console.warn("getDayById: no day found for id", id);
    return null;
  }

  const rawMetrics = (dayData as any).metrics;
  const metrics: Metrics | null = Array.isArray(rawMetrics)
    ? (rawMetrics[0] ?? null)
    : (rawMetrics ?? null);

  const dayId: string = dayData.id as string;

  // Fetch events for this day by day_id ONLY
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
    .eq("day_id", dayId)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("getDayById eventsError", eventsError);
  }

  const events: Event[] = (eventsData ?? []).map((e) => ({
    id: e.id as string,
    label: e.label as string,
    category: (e.category as Event["category"]) ?? "neutral",
    start_time: (e.start_time as string | null) ?? null,
    end_time: (e.end_time as string | null) ?? null,
    notes: (e.notes as string | null) ?? null,
  }));

  return {
    id: dayId,
    date: dayData.date as string,
    transcript: dayData.transcript as string,
    summary: (dayData.summary as string | null) ?? null,
    suggestions: (dayData.suggestions as string[] | null) ?? null,
    metrics,
    events,
  };
}

// ⬇️ Note: params is now a Promise in Next 16
type DayDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(
  props: DayDetailPageProps
): Promise<Metadata> {
  const { id } = await props.params; // ✅ unwrap the Promise
  return {
    title: isUuid(id) ? `Cadence – Day ${id}` : "Cadence – Day Detail",
  };
}

export default async function DayDetailPage(props: DayDetailPageProps) {
  const { id } = await props.params; // ✅ unwrap the Promise
  const day = await getDayById(id);

  if (!day) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="mb-4 text-2xl font-semibold">Day not found.</h1>
        <p className="text-sm text-slate-400">
          Check that the URL contains a valid day id, or go back to the
          dashboard.
        </p>
      </main>
    );
  }

  const { summary, suggestions, metrics, events, transcript } = day;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Day Detail – {day.date}</h1>
        {summary && (
          <p className="mt-2 text-slate-300">
            {summary}
          </p>
        )}
      </header>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <section className="mb-8 rounded-lg border border-emerald-500/20 bg-slate-900/60 p-4">
          <h2 className="mb-2 text-lg font-semibold text-emerald-300">
            Suggestions
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Metrics */}
      {metrics && (
        <section className="mb-8 grid gap-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4 sm:grid-cols-3">
          <MetricCard
            label="Productive"
            value={metrics.productive_hours ?? 0}
            unit="h"
          />
          <MetricCard
            label="Neutral"
            value={metrics.neutral_hours ?? 0}
            unit="h"
          />
          <MetricCard
            label="Wasted"
            value={metrics.wasted_hours ?? 0}
            unit="h"
          />
          <MetricCard
            label="Sleep"
            value={metrics.sleep_hours ?? 0}
            unit="h"
          />
          <MetricCard
            label="Focus blocks"
            value={metrics.focus_blocks ?? 0}
          />
          <MetricCard
            label="Context switches"
            value={metrics.context_switches ?? 0}
          />
        </section>
      )}

      {/* Timeline / events */}
      <section className="mb-8 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-sky-300">
          Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">
            No events recorded for this day.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-col gap-1 rounded-md bg-slate-900/80 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">
                    {ev.label}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                    {ev.category}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {ev.start_time && ev.end_time
                    ? `${ev.start_time} – ${ev.end_time}`
                    : ev.start_time || ev.end_time || "Time unknown"}
                </div>
                {ev.notes && (
                  <p className="text-xs text-slate-300">
                    {ev.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Transcript */}
      <section className="mb-8 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-200">
          Transcript
        </h2>
        <p className="whitespace-pre-wrap text-sm text-slate-300">
          {transcript}
        </p>
      </section>
    </main>
  );
}

type MetricCardProps = {
  label: string;
  value: number;
  unit?: string;
};

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/60 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-50">
        {value}
        {unit ? (
          <span className="ml-1 text-sm text-slate-400">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
