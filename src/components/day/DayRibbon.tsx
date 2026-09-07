import { timelineSegments, type TimelineEvent } from "@/lib/metrics";
import { CATEGORY_STYLES, categoryStyle } from "@/lib/categories";
import { MINUTES_PER_DAY } from "@/lib/time";

const LEGEND_ORDER = ["productive", "waste", "neutral", "sleep", "untracked"] as const;

/** The whole day as one 24-hour bar. */
export function DayRibbon({
  events,
  showLegend = true,
}: {
  events: TimelineEvent[];
  showLegend?: boolean;
}) {
  const segments = timelineSegments(events);

  return (
    <div>
      <div
        className="flex h-8 w-full overflow-hidden rounded-lg border border-line"
        role="img"
        aria-label="Twenty-four hour breakdown of this day"
      >
        {segments.map((seg, i) => {
          const style = categoryStyle(seg.category);
          const width = ((seg.end - seg.start) / MINUTES_PER_DAY) * 100;
          return (
            <div
              key={`${seg.start}-${i}`}
              className={`${style.fill} ${seg.category === "untracked" ? "opacity-25" : "opacity-85"}`}
              style={{ width: `${width}%` }}
              title={`${style.label} · ${Math.round((seg.end - seg.start) / 6) / 10}h`}
            />
          );
        })}
      </div>

      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>

      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {LEGEND_ORDER.map((key) => {
            const style = CATEGORY_STYLES[key];
            return (
              <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className={`h-2 w-2 rounded-full ${style.fill}`} />
                {style.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
