// app/day/[id]/DayTimeline.tsx
"use client";

type RawEvent = {
  id?: string;
  label: string;
  category: string; // accept any string; UI handles mapping
  start_time?: string | null; // DB shape
  end_time?: string | null;
  startTime?: string | null; // API shape
  endTime?: string | null;
  notes?: string | null;
};

type UiEvent = {
  id?: string;
  label: string;
  category: string;
  start: string; // HH:MM
  end: string;   // HH:MM
  notes?: string | null;
};

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

/**
 * Normalize events from DB/API into a consistent UiEvent shape.
 */
function normalizeEvents(events: RawEvent[]): UiEvent[] {
  return events.map((e) => ({
    id: e.id,
    label: e.label,
    category: e.category,
    start: (e.start_time ?? e.startTime ?? "00:00") as string,
    end: (e.end_time ?? e.endTime ?? "00:00") as string,
    notes: e.notes ?? null,
  }));
}

function pickMainSleep(events: UiEvent | UiEvent[] | null): UiEvent | null {
  if (!events) return null;
  const arr = Array.isArray(events) ? events : [events];
  const sleepEvents = arr.filter((e) => e.category === "sleep");
  if (sleepEvents.length === 0) return null;

  // Heuristic: main sleep = longest sleep block
  let best: UiEvent | null = null;
  let bestMinutes = -1;

  for (const e of sleepEvents) {
    const dur = Math.max(0, timeToMinutes(e.end) - timeToMinutes(e.start));
    if (dur > bestMinutes) {
      bestMinutes = dur;
      best = e;
    }
  }

  return best;
}

function groupEventsForTimeline(events: RawEvent[]) {
  const uiEvents = normalizeEvents(events);

  const mainSleep = pickMainSleep(uiEvents);

  const afterMidnightEvents: UiEvent[] = [];
  const daytimeEvents: UiEvent[] = [];

  for (const e of uiEvents) {
    // Never duplicate the main sleep block in other sections
    if (mainSleep && e === mainSleep) {
      continue;
    }

    const startM = timeToMinutes(e.start);
    const isBetweenMidnightAnd4 =
      startM >= 0 && startM < 4 * 60; // 00:00–03:59

    // Legacy safety: if we ever had auto-carried notes in DB, still treat those as after midnight
    const isLegacyCarried =
      (e.notes ?? "").trim() === "Auto-carried from previous day";

    const isAfterMidnight = isBetweenMidnightAnd4 || isLegacyCarried;

    if (isAfterMidnight) {
      afterMidnightEvents.push(e);
    } else {
      daytimeEvents.push(e);
    }
  }

  daytimeEvents.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  afterMidnightEvents.sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  return {
    mainSleep,
    daytimeEvents,
    afterMidnightEvents,
  };
}

type DayTimelineProps = {
  events: RawEvent[];
};

export function DayTimeline({ events }: DayTimelineProps) {
  const { mainSleep, daytimeEvents, afterMidnightEvents } =
    groupEventsForTimeline(events);

  return (
    <div className="space-y-4">
      {/* MAIN SLEEP SECTION */}
      {mainSleep && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold">
              Main sleep
            </span>
            <span className="text-[10px] text-slate-400">
              Night before – counted toward this morning&apos;s sleep
            </span>
          </div>
          <TimelineEventCard event={mainSleep} />
        </section>
      )}

      {/* DAYTIME EVENTS */}
      {daytimeEvents.length > 0 && (
        <section className="space-y-2">
          {!mainSleep && (
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              Day
            </div>
          )}
          <div className="space-y-2">
            {daytimeEvents.map((e) => (
              <TimelineEventCard
                key={e.id ?? e.label + e.start + e.end}
                event={e}
              />
            ))}
          </div>
        </section>
      )}

      {/* AFTER MIDNIGHT SECTION */}
      {afterMidnightEvents.length > 0 && (
        <section className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-sky-300">
            <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold">
              After midnight
            </span>
            <span className="text-[10px] text-slate-400">
              Late-night blocks between 00:00 and 04:00
            </span>
          </div>
          <div className="space-y-2">
            {afterMidnightEvents.map((e) => (
              <TimelineEventCard
                key={e.id ?? e.label + e.start + e.end}
                event={e}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- */
/* Simple event card (adjust to match your existing styling)       */
/* --------------------------------------------------------------- */

const categoryColors: Record<string, string> = {
  productive: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  neutral: "bg-slate-500/10 text-slate-200 border-slate-500/40",
  waste: "bg-rose-500/10 text-rose-300 border-rose-500/40",
  sleep: "bg-indigo-500/10 text-indigo-300 border-indigo-500/40",
  untracked: "bg-amber-500/10 text-amber-300 border-amber-500/40",
};

function TimelineEventCard({ event }: { event: UiEvent }) {
  const catKey = event.category ?? "neutral";
  const categoryClass =
    categoryColors[catKey] ?? categoryColors["neutral"];

  return (
    <div className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mt-1 text-xs font-mono text-slate-400 w-16 shrink-0">
        <div>{event.start}</div>
        <div className="text-slate-500">→ {event.end}</div>
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-slate-100">
            {event.label}
          </div>
          <span
            className={
              "rounded-full border px-2 py-[2px] text-[10px] font-semibold " +
              categoryClass
            }
          >
            {event.category}
          </span>
        </div>

        {event.notes && (
          <p className="text-[11px] text-slate-400 whitespace-pre-line">
            {event.notes}
          </p>
        )}
      </div>
    </div>
  );
}
