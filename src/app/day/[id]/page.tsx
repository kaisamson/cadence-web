// app/day/[id]/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getDayById, isUuid } from "@/lib/getDayById";
import DayEditor from "./DayEditor";
import { DeleteDayButton } from "./DeleteDayButton";


export const dynamic = "force-dynamic";

type DayDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function requireAuthForDay(path: string) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("cadence_auth");
  if (auth?.value !== "1") {
    redirect(`/login?from=${encodeURIComponent(path)}`);
  }
}

export async function generateMetadata(
  props: DayDetailPageProps
): Promise<Metadata> {
  const { id } = await props.params;
  return {
    title: isUuid(id) ? `Cadence – Day ${id}` : "Cadence – Day Detail",
  };
}

export default async function DayDetailPage(props: DayDetailPageProps) {
  const { id } = await props.params;
  await requireAuthForDay(`/day/${id}`);
  const day = await getDayById(id);

  if (!day) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
        <h1 className="mb-4 text-2xl font-semibold">Day not found.</h1>
        <p className="text-sm text-slate-400">
          Check that the URL contains a valid day id, or go back to the
          dashboard.
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard"
            className="text-sm text-sky-300 hover:text-sky-200"
          >
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { summary, suggestions, metrics, events, transcript } = day;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-100">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Day Detail – {day.date}</h1>
          {summary && <p className="mt-2 text-slate-300">{summary}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/dashboard"
            className="self-start rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 hover:border-emerald-500 hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>
          <DeleteDayButton dayId={day.id} />
        </div>
      </header>


      {/* 🔊 Speech + edit bar at the top */}
      <DayEditor date={day.date} />

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

      <section className="mb-8 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-sky-300">Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">
            No events recorded for this day.
          </p>
        ) : (
          <div className="relative">
            {/* vertical line */}
            <div className="pointer-events-none absolute left-[10px] top-0 bottom-0 w-px bg-slate-700" />
            <ul className="space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="relative pl-8">
                  {/* dot */}
                  <div className="absolute left-[6px] top-2 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.3)]" />

                  <div className="flex gap-3">
                    {/* time column */}
                    <div className="w-24 shrink-0 text-[11px] text-slate-400">
                      {ev.start_time && ev.end_time
                        ? `${ev.start_time}–${ev.end_time}`
                        : ev.start_time || ev.end_time || "Time?"}
                    </div>

                    {/* event card */}
                    <div className="flex-1 rounded-md border border-slate-800 bg-slate-900/80 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-100">
                          {ev.label}
                        </span>
                        <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          ev.category === "productive"
                            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
                            : ev.category === "sleep"
                            ? "bg-sky-500/10 text-sky-300 border border-sky-500/40"
                            : ev.category === "waste"
                            ? "bg-red-500/10 text-red-300 border border-red-500/40"
                            : ev.category === "untracked"
                            ? "bg-slate-500/20 text-slate-200 border border-slate-500/60"
                            : "bg-slate-500/10 text-slate-300 border border-slate-500/40"
                        }`}
                      >
                        {ev.category}
                      </span>

                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {ev.start_time && ev.end_time
                          ? `${ev.start_time}–${ev.end_time}`
                          : ev.start_time || ev.end_time || "Time unknown"}
                      </div>
                      {ev.notes && (
                        <p className="mt-1 text-[11px] text-slate-300">
                          {ev.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
        {unit && (
          <span className="ml-1 text-sm text-slate-400">{unit}</span>
        )}
      </div>
    </div>
  );
}
