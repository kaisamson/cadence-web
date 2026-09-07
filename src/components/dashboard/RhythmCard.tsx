import type { WeekdayStat, WakeConsistency } from "@/lib/insights";
import { minutesToTime, formatClock, formatDuration } from "@/lib/time";

export function RhythmCard({
  weekdays,
  wake,
}: {
  weekdays: WeekdayStat[];
  wake: WakeConsistency;
}) {
  const withData = weekdays.filter((d) => d.samples > 0);
  const peak = Math.max(1, ...withData.map((d) => d.signalHours));

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Weekly rhythm</h2>
      <p className="mt-0.5 text-xs text-ink-muted">Average signal hours</p>

      <div className="mt-4 flex items-end justify-between gap-1.5" role="img"
           aria-label="Average signal hours for each day of the week">
        {weekdays.map((d) => {
          const height = d.samples ? Math.max(4, (d.signalHours / peak) * 100) : 3;
          return (
            <div key={d.weekday} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-ink-faint">
                {d.samples ? d.signalHours.toFixed(1) : "–"}
              </span>
              <div className="flex h-20 w-full items-end">
                <div
                  className={`w-full rounded-t ${
                    d.samples ? "bg-signal" : "bg-surface-3"
                  } ${d.samples && d.signalHours === peak ? "" : "opacity-70"}`}
                  style={{ height: `${height}%` }}
                  title={`${d.weekday}: ${d.signalHours.toFixed(1)}h signal from ${d.samples} days`}
                />
              </div>
              <span className="text-[10px] font-medium text-ink-muted">{d.weekday}</span>
            </div>
          );
        })}
      </div>

      {wake.median != null && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-ink-muted">Typical wake-up</span>
            <span className="text-sm font-semibold tabular-nums text-rest">
              {formatClock(minutesToTime(wake.median))}
            </span>
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-ink-faint">
            ±{formatDuration(wake.spreadMinutes ?? 0)}
            {wake.earliest != null && wake.latest != null && (
              <> · {formatClock(minutesToTime(wake.earliest))}–{formatClock(minutesToTime(wake.latest))}</>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
