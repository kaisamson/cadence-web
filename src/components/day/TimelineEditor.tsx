"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EDITABLE_CATEGORIES, categoryStyle } from "@/lib/categories";
import { computeMetrics } from "@/lib/metrics";
import { formatClock, formatDuration, timeToMinutes } from "@/lib/time";
import type { DayEvent } from "@/lib/days";

/** Where the day splits when there is no morning sleep block to anchor on. */
const AFTER_MIDNIGHT_CUTOFF = 4 * 60;

/** A sleep run starting later than this is a nap or an early night — it ends on
 *  this date rather than opening it, so it cannot anchor the split. */
const LATEST_ANCHOR_SLEEP_START = 8 * 60;

/**
 * The minute this date starts *as lived*: the moment the night's main sleep
 * begins. Anything before it happened after midnight and belongs to the
 * previous evening, so it must not lead the timeline.
 *
 * A fixed clock cutoff cannot do this job — going to bed at 02:30 put the
 * night's sleep on the wrong side of a 04:00 line, filing it with the previous
 * evening's blocks instead of opening the morning.
 */
function dayStartMinute(events: DayEvent[]): number {
  const { mainSleepStart } = computeMetrics(events);
  if (mainSleepStart != null && mainSleepStart < LATEST_ANCHOR_SLEEP_START) {
    return mainSleepStart;
  }
  return AFTER_MIDNIGHT_CUTOFF;
}

type Props = { events: DayEvent[] };

export function TimelineEditor({ events }: Props) {
  const dayStart = dayStartMinute(events);
  const nightBefore = events.filter((e) => {
    const m = timeToMinutes(e.startTime);
    return m != null && m < dayStart;
  });
  const daytime = events.filter((e) => !nightBefore.includes(e));

  if (events.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No events recorded for this day yet.</p>
    );
  }

  return (
    <div className="space-y-5">
      {daytime.length > 0 && (
        <section>
          {nightBefore.length > 0 && (
            <SectionLabel title="Day" hint="From when you went to sleep" />
          )}
          <div className={nightBefore.length > 0 ? "mt-2 space-y-1.5" : "space-y-1.5"}>
            {daytime.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {nightBefore.length > 0 && (
        <section>
          <SectionLabel
            title="After midnight"
            hint="The tail of the previous evening, before you slept"
          />
          <div className="mt-2 space-y-1.5">
            {nightBefore.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </span>
      {hint && <span className="text-[10px] text-ink-faint">{hint}</span>}
    </div>
  );
}

function EventRow({ event }: { event: DayEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(event.label);
  const [category, setCategory] = useState(event.category);
  const [startTime, setStartTime] = useState(event.startTime ?? "");
  const [endTime, setEndTime] = useState(event.endTime ?? "");

  const style = categoryStyle(event.category);
  const startM = timeToMinutes(event.startTime);
  const endM = timeToMinutes(event.endTime);
  const duration = startM != null && endM != null ? endM - startM : null;

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save that change");
      router.refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${event.label}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete that event");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-lg border ${open ? "border-line-strong" : "border-line"} bg-surface-2`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        {/* Category stripe carries the meaning without a wordy pill */}
        <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${style.fill}`} aria-hidden="true" />

        <span className="w-[4.5rem] shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-ink-muted">
          {formatClock(event.startTime)}
          <span className="block text-ink-faint">{formatClock(event.endTime)}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{event.label}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
            <span className={style.text}>{style.label}</span>
            {duration != null && (
              <span className="text-ink-faint">{formatDuration(duration)}</span>
            )}
          </span>
          {event.notes && !open && (
            <span className="mt-1 block truncate text-[11px] text-ink-faint">
              {event.notes}
            </span>
          )}
        </span>

        <svg
          viewBox="0 0 24 24"
          className={`mt-1.5 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-line px-3 py-3">
          {event.notes && (
            <p className="mb-3 text-[11px] leading-relaxed text-ink-muted">{event.notes}</p>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
            What
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-surface-3 px-2.5 py-2 text-sm text-ink outline-none focus:border-line-strong"
          />

          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
            Category
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {EDITABLE_CATEGORIES.map((key) => {
              const s = categoryStyle(key);
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? `${s.bg} ${s.border} ${s.text}`
                      : "border-line text-ink-muted hover:border-line-strong",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface-3 px-2.5 py-2 text-sm tabular-nums text-ink outline-none focus:border-line-strong"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-surface-3 px-2.5 py-2 text-sm tabular-nums text-ink outline-none focus:border-line-strong"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-2 text-[11px] text-noise">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ label, category, startTime, endTime })}
              className="flex-1 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-canvas disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={remove}
              className="rounded-md border border-noise/40 px-3 py-2 text-xs font-medium text-noise hover:bg-noise/10 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
