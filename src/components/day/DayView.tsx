import Link from "next/link";

import type { DayRecord } from "@/lib/days";
import { RecapComposer } from "@/components/RecapComposer";
import { DayRibbon } from "./DayRibbon";
import { TimelineEditor } from "./TimelineEditor";
import { DeleteDayButton } from "./DeleteDayButton";
import { GapFiller } from "./GapFiller";
import { SignalToNoise } from "@/components/dashboard/SignalToNoise";
import { Card, StatTile } from "@/components/ui/primitives";
import { findGaps } from "@/lib/insights";
import { formatDate, relativeDayLabel } from "@/lib/time";

export function DayView({
  day,
  date,
  today,
}: {
  day: DayRecord | null;
  date: string;
  today: string;
}) {
  const label = relativeDayLabel(date, today);
  const isNamedDay = label !== formatDate(date);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            {isNamedDay ? formatDate(date) : null}
          </p>
        </div>
        {day && <DeleteDayButton dayId={day.id} />}
      </header>

      <RecapComposer
        date={date}
        mode={day ? "append" : "create"}
        placeholder={
          day
            ? "I actually started at 1pm, and I was studying but kept checking my phone…"
            : undefined
        }
      />

      {!day ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-ink">Nothing logged for this day yet</p>
        </Card>
      ) : (
        <>
          {day.summary && (
            <Card className="p-4">
              <p className="text-sm leading-relaxed text-ink/90">{day.summary}</p>
            </Card>
          )}

          <Card className="p-4">
            <DayRibbon events={day.events} />
          </Card>

          <SignalToNoise totals={day.metrics} />

          <DayMetrics metrics={day.metrics} />

          <GapFiller date={date} gaps={findGaps(day.events)} />

          {day.suggestions.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Do differently tomorrow</h2>
              <ul className="mt-2.5 space-y-2">
                {day.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink/85">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            <TimelineEditor events={day.events} />
          </Card>

          {day.transcripts.length > 0 && (
            <details className="rounded-card border border-line bg-surface">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-muted hover:text-ink">
                What you said
                <span className="ml-1.5 text-[11px] font-normal text-ink-faint">
                  ({day.transcripts.length}{" "}
                  {day.transcripts.length === 1 ? "recap" : "recaps"})
                </span>
              </summary>
              <div className="space-y-3 border-t border-line px-4 py-3">
                {day.transcripts.map((t, i) => (
                  <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">
                    {t}
                  </p>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <div className="pt-1">
        <Link href="/dashboard" className="text-xs text-ink-muted hover:text-ink">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function DayMetrics({ metrics }: { metrics: DayRecord["metrics"] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <StatTile label="Signal" value={metrics.productiveHours.toFixed(1)} unit="h" />
      <StatTile label="Noise" value={metrics.wastedHours.toFixed(1)} unit="h" />
      <StatTile label="Upkeep" value={metrics.neutralHours.toFixed(1)} unit="h" />
      <StatTile label="Sleep" value={metrics.sleepHours.toFixed(1)} unit="h" />
      <StatTile
        label="Deep work"
        value={metrics.deepWorkHours.toFixed(1)}
        unit="h"
        hint="in 45+ min stretches"
      />
      <StatTile label="Unaccounted" value={metrics.untrackedHours.toFixed(1)} unit="h" />
    </div>
  );
}
