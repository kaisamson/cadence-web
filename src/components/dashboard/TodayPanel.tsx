import Link from "next/link";

import type { DayRecord } from "@/lib/days";
import { RecapComposer } from "@/components/RecapComposer";
import { DayRibbon } from "@/components/day/DayRibbon";
import { signalShare } from "@/lib/metrics";
import { formatDate } from "@/lib/time";

/**
 * The top of the dashboard and the app's primary action: record today.
 *
 * Deliberately a summary, not the full day view — the timeline and per-event
 * editing live on the day's own page, one tap away.
 */
export function TodayPanel({ day, date }: { day: DayRecord | null; date: string }) {
  const share = day ? signalShare(day.metrics) : null;

  return (
    <section id="log" className="scroll-mt-20 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-0.5 text-xs text-ink-muted">{formatDate(date)}</p>
        </div>
        {day && (
          <Link
            href={`/day/${day.id}`}
            className="shrink-0 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Open full day →
          </Link>
        )}
      </div>

      <RecapComposer date={date} mode={day ? "append" : "create"} />

      {day && (
        <div className="rounded-card border border-line bg-surface p-4">
          {day.summary && (
            <p className="mb-3 text-[13px] leading-relaxed text-ink/85">{day.summary}</p>
          )}

          <DayRibbon events={day.events} />

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Figure label="Signal" value={`${day.metrics.productiveHours.toFixed(1)}h`} tone="text-signal" />
            <Figure label="Noise" value={`${day.metrics.wastedHours.toFixed(1)}h`} tone="text-noise" />
            <Figure label="Sleep" value={`${day.metrics.sleepHours.toFixed(1)}h`} tone="text-rest" />
            <Figure
              label="Unaccounted"
              value={`${day.metrics.untrackedHours.toFixed(1)}h`}
              tone="text-ink-muted"
            />
          </dl>

          {share != null && (
            <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">{share.toFixed(0)}%</span> of your
              active time today was signal.
            </p>
          )}

          {day.suggestions.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
              {day.suggestions.slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
