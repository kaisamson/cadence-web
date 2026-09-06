"use client";

import { useId, useMemo, useState } from "react";
import { formatShortDate } from "@/lib/time";

type Props = {
  title: string;
  subtitle?: string;
  dates: string[];
  values: (number | null)[];
  unit?: string;
  /** Colour token class for the line, e.g. "text-signal". */
  tone?: string;
  /** Dashed reference line, e.g. a sleep target. */
  target?: { value: number; label: string } | null;
};

const W = 300;
const H = 90;
const PAD = { top: 8, right: 4, bottom: 4, left: 4 };

/**
 * Single-series trend. One series means no legend is needed — the card title
 * names it — but a hover crosshair is always present, because a static line
 * with no way to read a value is just decoration.
 */
export function TrendChart({
  title,
  subtitle,
  dates,
  values,
  unit = "",
  tone = "text-ink",
  target = null,
}: Props) {
  const clipId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const { points, scaleY, hasData, min, max } = useMemo(() => {
    const valid = values.filter((v): v is number => v != null);
    const lo = valid.length ? Math.min(...valid, target?.value ?? Infinity) : 0;
    const hi = valid.length ? Math.max(...valid, target?.value ?? -Infinity) : 1;
    const span = hi - lo || 1;
    // A little headroom so the line never touches the card edge.
    const padded = { lo: lo - span * 0.15, hi: hi + span * 0.15 };

    const sx = (i: number) =>
      values.length <= 1
        ? W / 2
        : PAD.left + (i / (values.length - 1)) * (W - PAD.left - PAD.right);
    const sy = (v: number) =>
      H - PAD.bottom -
      ((v - padded.lo) / (padded.hi - padded.lo)) * (H - PAD.top - PAD.bottom);

    return {
      points: values.map((v, i) => (v == null ? null : { x: sx(i), y: sy(v), v, i })),
      scaleY: sy,
      hasData: valid.length > 0,
      min: lo,
      max: hi,
    };
  }, [values, target]);

  // Break the path at gaps rather than interpolating across missing days.
  const segments = useMemo(() => {
    const out: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    for (const p of points) {
      if (p) run.push({ x: p.x, y: p.y });
      else if (run.length) {
        out.push(run);
        run = [];
      }
    }
    if (run.length) out.push(run);
    return out;
  }, [points]);

  const latest = [...values].reverse().find((v) => v != null) ?? null;
  const hovered = hover != null ? points[hover] : null;

  if (!hasData) {
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        <div className="mt-6 flex h-20 items-center justify-center text-xs text-ink-faint">
          Not enough data yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-faint">
            {hovered ? formatShortDate(dates[hovered.i]) : "Latest"}
          </div>
          <div className={`text-lg font-semibold tabular-nums ${tone}`}>
            {(hovered?.v ?? latest)?.toFixed(1)}
            {unit}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-24 w-full touch-none"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          setHover(
            Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1))))
          );
        }}
        role="img"
        aria-label={`${title}: ranges from ${min.toFixed(1)} to ${max.toFixed(1)}${unit}`}
      >
        <defs>
          <linearGradient id={clipId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className={tone}>
          {target && (
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={scaleY(target.value)}
              y2={scaleY(target.value)}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.35"
            />
          )}

          {segments.map((seg, i) => (
            <g key={i}>
              {seg.length > 1 && (
                <path
                  d={
                    `M ${seg[0].x} ${H - PAD.bottom} ` +
                    seg.map((p) => `L ${p.x} ${p.y}`).join(" ") +
                    ` L ${seg[seg.length - 1].x} ${H - PAD.bottom} Z`
                  }
                  fill={`url(#${clipId})`}
                  stroke="none"
                />
              )}
              <path
                d={seg.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}

          {hovered && (
            <>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
              {/* Surface ring keeps the marker legible over the fill */}
              <circle cx={hovered.x} cy={hovered.y} r="4" fill="currentColor"
                      stroke="var(--color-surface)" strokeWidth="2"
                      vectorEffect="non-scaling-stroke" />
            </>
          )}
        </g>
      </svg>

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>{formatShortDate(dates[0])}</span>
        <span>{formatShortDate(dates[dates.length - 1])}</span>
      </div>
    </div>
  );
}
