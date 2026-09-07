import type { SignalNoise } from "@/lib/metrics";
import { signalShare } from "@/lib/metrics";
import { formatShortDate } from "@/lib/time";

export type Split = { signal: number; noise: number };

/** Active time as parts of 100. Rounding the signal half keeps the pair at 100. */
export function splitOf(totals: SignalNoise): Split | null {
  const share = signalShare(totals);
  if (share == null) return null;
  const signal = Math.round(share);
  return { signal, noise: 100 - signal };
}

export function SplitFigure({
  split,
  className = "text-5xl",
}: {
  split: Split | null;
  className?: string;
}) {
  if (!split) {
    return <span className={`${className} font-semibold text-ink-faint`}>—</span>;
  }

  return (
    <span className="flex items-baseline gap-1">
      <span className={`${className} font-semibold leading-none tabular-nums text-signal`}>
        {split.signal}
      </span>
      <span className="text-lg font-medium leading-none text-ink-faint">:</span>
      <span className={`${className} font-semibold leading-none tabular-nums text-noise`}>
        {split.noise}
      </span>
    </span>
  );
}

export type RatioPoint = { date: string; totals: SignalNoise | null };

/** The headline number: how every 100 minutes of active time splits. */
export function SignalToNoise({
  totals,
  previous,
  series,
  label,
}: {
  totals: SignalNoise;
  previous?: SignalNoise;
  series?: RatioPoint[];
  label?: string;
}) {
  const split = splitOf(totals);
  const priorSplit = previous ? splitOf(previous) : null;

  // Points, not percent: a share that moves 80 → 85 has "risen 6%", which
  // nobody reads correctly. Five points is unambiguous.
  const deltaPts = split && priorSplit ? split.signal - priorSplit.signal : null;
  const showDelta = deltaPts != null && Math.abs(deltaPts) >= 1;

  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Signal-to-noise</h2>
        {label && <span className="text-xs text-ink-muted">{label}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <SplitFigure split={split} />

        {showDelta && (
          <span
            className={`text-xs font-medium tabular-nums ${
              deltaPts > 0 ? "text-signal" : "text-noise"
            }`}
          >
            {deltaPts > 0 ? "▲" : "▼"} {Math.abs(deltaPts)} pts vs previous
          </span>
        )}
      </div>

      <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
        {split && (
          <>
            <div className="bg-signal" style={{ width: `${split.signal}%` }} />
            <div className="bg-noise" style={{ width: `${split.noise}%` }} />
          </>
        )}
      </div>

      <div className="mt-2 flex justify-between text-xs tabular-nums">
        <span className="text-signal">{totals.productiveHours.toFixed(1)}h signal</span>
        <span className="text-noise">{totals.wastedHours.toFixed(1)}h noise</span>
      </div>

      {series && series.length > 0 && <SplitStrip series={series} />}
    </section>
  );
}

function SplitStrip({ series }: { series: RatioPoint[] }) {
  const first = formatShortDate(series[0].date);
  const last = formatShortDate(series[series.length - 1].date);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div
        className="relative flex h-16 items-end gap-1 pr-8"
        role="img"
        aria-label={`Daily signal-to-noise split, ${first} to ${last}`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
          style={{ bottom: "50%" }}
          aria-hidden="true"
        >
          <span className="absolute right-0 top-0 -translate-y-1/2 text-[10px] tabular-nums text-ink-faint">
            50:50
          </span>
        </div>

        {series.map((point) => {
          const split = point.totals ? splitOf(point.totals) : null;

          if (!split) {
            return (
              <div
                key={point.date}
                className="h-1 flex-1 rounded-sm bg-surface-3"
                title={`${formatShortDate(point.date)} · no active time`}
              />
            );
          }

          return (
            <div
              key={point.date}
              className={`flex-1 rounded-sm ${split.signal >= 50 ? "bg-signal" : "bg-noise"}`}
              style={{ height: `${Math.max(4, split.signal)}%` }}
              title={`${formatShortDate(point.date)} · ${split.signal}:${split.noise}`}
            />
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between pr-8 text-[10px] tabular-nums text-ink-faint">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
