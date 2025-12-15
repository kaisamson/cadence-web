// app/day/[id]/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getDayById, isUuid } from "@/lib/getDayById";
import DayEditor from "./DayEditor";
import { DeleteDayButton } from "./DeleteDayButton";
import { DayTimeline } from "./DayTimeline";

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
      <main className="mx-auto max-w-4xl px-4 py-10 text-white">
        <h1 className="mb-4 text-2xl font-semibold">Day not found.</h1>
        <p className="text-sm text-white/60">
          Check that the URL contains a valid day id, or go back to the
          dashboard.
        </p>
        <div className="mt-4">
          <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { summary, suggestions, metrics, events, transcript } = day;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-white">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Day Detail – {day.date}</h1>
          {summary && <p className="mt-2 text-white/75">{summary}</p>}
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link
            href="/dashboard"
            className="self-start rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/85 hover:border-white/25 hover:text-white"
          >
            ← Back to dashboard
          </Link>
          <DeleteDayButton dayId={day.id} />
        </div>
      </header>

      {/* 🔊 Speech + edit bar at the top */}
      <DayEditor date={day.date} />

      {suggestions && suggestions.length > 0 && (
        <section className="mb-8 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-2 text-lg font-semibold text-white/90">
            Suggestions
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-white/80">
            {suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {metrics && (
        <section className="mb-8 grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-3">
          <MetricCard label="Productive" value={metrics.productive_hours ?? 0} unit="h" />
          <MetricCard label="Neutral" value={metrics.neutral_hours ?? 0} unit="h" />
          <MetricCard label="Wasted" value={metrics.wasted_hours ?? 0} unit="h" />
          <MetricCard label="Sleep" value={metrics.sleep_hours ?? 0} unit="h" />
          <MetricCard label="Focus blocks" value={metrics.focus_blocks ?? 0} />
          <MetricCard label="Context switches" value={metrics.context_switches ?? 0} />
        </section>
      )}

      {/* 🕒 Timeline with Main sleep + After midnight chips */}
      <section className="mb-8 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <h2 className="mb-3 text-lg font-semibold text-white/90">Timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-white/60">No events recorded for this day.</p>
        ) : (
          <DayTimeline events={events} />
        )}
      </section>

      <section className="mb-8 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <h2 className="mb-3 text-lg font-semibold text-white/90">Transcript</h2>
        <p className="whitespace-pre-wrap text-sm text-white/75">{transcript}</p>
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
    <div className="rounded-md border border-white/10 bg-black/40 p-3">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white/95">
        {value}
        {unit && <span className="ml-1 text-sm text-white/55">{unit}</span>}
      </div>
    </div>
  );
}
