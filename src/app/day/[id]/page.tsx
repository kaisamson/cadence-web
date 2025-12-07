// app/day/[id]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const OWNER_ID = process.env.OWNER_ID;

if (!OWNER_ID) {
  throw new Error("OWNER_ID is not set in environment variables");
}

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

function isIsoDate(value: string): boolean {
  // Very simple YYYY-MM-DD check; avoids hitting Supabase with garbage
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function getDayByDate(date: string): Promise<DayDetail | null> {
  if (!date || date === "undefined") {
    return null;
  }

  if (!isIsoDate(date)) {
    // Avoid 22P02 by never querying with non-date junk
    return null;
  }

  // Fetch the day row + its metrics (via metrics_id)
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
    .eq("user_id", OWNER_ID)
    .eq("date", date)
    .maybeSingle();

  if (dayError) {
    console.error("getDayByDate dayError", dayError);
    return null;
  }

  if (!dayData) {
    return null;
  }

  const rawMetrics = (dayData as any).metrics;
  const metrics: Metrics | null = Array.isArray(rawMetrics)
    ? (rawMetrics[0] ?? null)
    : (rawMetrics ?? null);

  const dayId: string = dayData.id as string;

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
    .eq("day_id", dayId)
    .eq("user_id", OWNER_ID)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("getDayByDate eventsError", eventsError);
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

type DayDetailPageProps = {
  params: { id: string }; // this is actually the date slug: YYYY-MM-DD
};

export async function generateMetadata(
  props: DayDetailPageProps
): Promise<Metadata> {
  const { id } = props.params;
  const dateSlug = id;
  return {
    title: isIsoDate(dateSlug)
      ? `Cadence – Day ${dateSlug}`
      : "Cadence – Day Detail",
  };
}

export default async function DayDetailPage({ params }: DayDetailPageProps) {
  const dateSlug = params.id;
  const day = await getDayByDate(dateSlug);

  if (!day) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="mb-4 text-2xl font-semibold">Day not found.</h1>
        <p className="text-sm text-slate-400">
          Check that the URL contains a valid date (YYYY-MM-DD), or go back to
          the dashboard.
        </p>
      </main>
    );
  }

  const { summary, suggestions, metrics, events, transcript } = day;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">
          Day Detail – {day.date}
        </h1>
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
        {unit ? <span className="ml-1 text-sm text-slate-400">{unit}</span> : null}
      </div>
    </div>
  );
}
