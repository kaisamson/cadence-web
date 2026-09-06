import Link from "next/link";
import type { LoggingStatus as Status } from "@/lib/insights";
import { formatWeekday, formatShortDate } from "@/lib/time";

/**
 * Logging consistency, surfaced first because every other number depends on it:
 * a metric drawn from 60% of days is a metric with a 40% hole in it.
 */
export function LoggingStatus({ status }: { status: Status }) {
  const catchUp = status.missingRecent.slice(0, 4);

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              Streak
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums">{status.streak}</span>
              <span className="text-xs text-ink-muted">
                {status.streak === 1 ? "day" : "days"}
              </span>
            </div>
          </div>

          <div className="h-9 w-px bg-line" aria-hidden="true" />

          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
              Last 30 days
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  status.coverage30 >= 80 ? "text-signal" : "text-ink"
                }`}
              >
                {status.coverage30}%
              </span>
              <span className="text-xs text-ink-muted">logged</span>
            </div>
          </div>
        </div>

        {status.todayMissing && (
          <Link
            href="#log"
            className="rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-canvas hover:opacity-90"
          >
            Log today
          </Link>
        )}
      </div>

      {catchUp.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[11px] text-ink-muted">
            Catch up on a missed day — it only takes a sentence:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {catchUp.map((date) => (
              <Link
                key={date}
                href={`/day/new?date=${date}`}
                className="rounded-full border border-line px-3 py-1.5 text-[11px] font-medium text-ink-muted hover:border-line-strong hover:text-ink"
              >
                {formatWeekday(date)} {formatShortDate(date)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
