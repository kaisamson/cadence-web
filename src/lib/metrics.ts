// lib/metrics.ts
//
// Metrics are DERIVED from the event timeline, never taken from the model.
// The model is good at turning speech into a timeline and bad at arithmetic:
// across the existing log, model-reported metrics disagreed with the model's
// own events by up to 3.5h/day and summed to 16–21h instead of 24h.
//
// Here we paint a 1440-minute canvas from the events and count minutes, so the
// numbers always reconcile with what is on screen and always total 24h.

import { MINUTES_PER_DAY, timeToMinutes } from "./time";

export const CATEGORIES = [
  "productive",
  "neutral",
  "waste",
  "sleep",
] as const;

export type Category = (typeof CATEGORIES)[number];
/** "untracked" is a real category on events but is never a metric bucket —
 *  it represents minutes we deliberately refuse to attribute. */
export type EventCategory = Category | "untracked";

export type TimelineEvent = {
  label: string;
  category: string;
  /** "HH:MM" or "HH:MM:SS" */
  startTime: string | null;
  endTime: string | null;
  notes?: string | null;
};

export type DerivedMetrics = {
  productiveHours: number;
  neutralHours: number;
  wastedHours: number;
  sleepHours: number;
  /** Minutes no event accounted for, or explicitly marked "untracked". */
  untrackedHours: number;
  /**
   * Productive hours that sit inside an unbroken run of at least
   * FOCUS_BLOCK_MINUTES. Preferred over the raw block count as a target:
   * being interrupted three times turns one 3h stretch into three qualifying
   * blocks, so a count *rewards* fragmentation, while these hours fall.
   */
  deepWorkHours: number;
  focusBlocks: number;
  contextSwitches: number;
  /**
   * The night's main sleep — the longest unbroken rest run — as minutes from
   * midnight. Naps are counted in sleepHours but must not define the wake time:
   * a 3pm nap ending at 23:00 otherwise reads as "woke at 11pm".
   */
  mainSleepStart: number | null;
  mainSleepEnd: number | null;
  mainSleepHours: number;
};

/** A productive run must reach this long to count as a focus block. */
const FOCUS_BLOCK_MINUTES = 45;

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function normalizeCategory(raw: string | null | undefined): EventCategory {
  const c = (raw ?? "").trim().toLowerCase();
  if (isCategory(c)) return c;
  if (c === "wasted" || c === "noise") return "waste";
  if (c === "productive_time" || c === "signal") return "productive";
  return "untracked";
}

/**
 * Paint events onto a minute canvas.
 *
 * Events are allowed to overlap — the prompt actively encourages stacking
 * (e.g. "studying while checking my phone"). We paint longest-first so that
 * shorter, more specific blocks land on top: a 15-minute scroll nested inside a
 * 2-hour study block correctly carves 15 minutes out of it rather than
 * double-counting 15 minutes of the day.
 *
 * Returns one entry per minute: a Category, or null for unaccounted time.
 */
export function paintTimeline(events: TimelineEvent[]): (Category | null)[] {
  const canvas: (Category | null)[] = new Array(MINUTES_PER_DAY).fill(null);

  const spans = events
    .map((e) => {
      const start = timeToMinutes(e.startTime);
      const end = timeToMinutes(e.endTime);
      const category = normalizeCategory(e.category);
      if (start == null || end == null) return null;
      // Guard against inverted or zero-length spans from the model.
      if (end <= start) return null;
      return {
        start: Math.max(0, start),
        end: Math.min(MINUTES_PER_DAY, end),
        category,
      };
    })
    .filter((s): s is { start: number; end: number; category: EventCategory } =>
      s !== null
    )
    // Longest first, so the most specific block wins the overlap.
    .sort((a, b) => b.end - b.start - (a.end - a.start));

  for (const span of spans) {
    // "untracked" events stay unpainted — they are an admission of ignorance,
    // not a bucket, and we want them visible as unaccounted time.
    if (span.category === "untracked") continue;
    for (let m = span.start; m < span.end; m++) {
      canvas[m] = span.category;
    }
  }

  return canvas;
}

/**
 * Count contiguous productive runs of at least FOCUS_BLOCK_MINUTES, and the
 * number of times the day switches between different waking categories.
 */
function countRuns(canvas: (Category | null)[]): {
  focusBlocks: number;
  deepWorkMinutes: number;
  contextSwitches: number;
} {
  let focusBlocks = 0;
  let deepWorkMinutes = 0;
  let contextSwitches = 0;

  let runCategory: Category | null = null;
  let runLength = 0;
  // Previous *waking* category, used so that sleeping doesn't inflate switches.
  let prevWaking: Category | null = null;

  const flush = () => {
    if (runCategory === "productive" && runLength >= FOCUS_BLOCK_MINUTES) {
      focusBlocks++;
      deepWorkMinutes += runLength;
    }
  };

  for (let m = 0; m < canvas.length; m++) {
    const c = canvas[m];

    if (c === runCategory) {
      runLength++;
      continue;
    }

    flush();
    runCategory = c;
    runLength = 1;

    if (c !== null && c !== "sleep") {
      if (prevWaking !== null && prevWaking !== c) contextSwitches++;
      prevWaking = c;
    }
  }
  flush();

  return { focusBlocks, deepWorkMinutes, contextSwitches };
}

/** Derive a full, self-consistent metric set from a day's events. */
export function computeMetrics(events: TimelineEvent[]): DerivedMetrics {
  const canvas = paintTimeline(events);

  const minutes: Record<Category, number> = {
    productive: 0,
    neutral: 0,
    waste: 0,
    sleep: 0,
  };
  let unaccounted = 0;

  for (const c of canvas) {
    if (c === null) unaccounted++;
    else minutes[c]++;
  }

  const { focusBlocks, deepWorkMinutes, contextSwitches } = countRuns(canvas);
  const mainSleep = findMainSleep(canvas);
  const h = (m: number) => Math.round((m / 60) * 100) / 100;

  return {
    productiveHours: h(minutes.productive),
    neutralHours: h(minutes.neutral),
    wastedHours: h(minutes.waste),
    sleepHours: h(minutes.sleep),
    untrackedHours: h(unaccounted),
    deepWorkHours: h(deepWorkMinutes),
    focusBlocks,
    contextSwitches,
    mainSleepStart: mainSleep?.start ?? null,
    mainSleepEnd: mainSleep?.end ?? null,
    mainSleepHours: mainSleep ? h(mainSleep.end - mainSleep.start) : 0,
  };
}

/** Longest contiguous run of sleep on the canvas. */
function findMainSleep(
  canvas: (Category | null)[]
): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  let runStart: number | null = null;

  for (let m = 0; m <= canvas.length; m++) {
    const isSleep = m < canvas.length && canvas[m] === "sleep";
    if (isSleep && runStart === null) {
      runStart = m;
    } else if (!isSleep && runStart !== null) {
      const run = { start: runStart, end: m };
      if (!best || run.end - run.start > best.end - best.start) best = run;
      runStart = null;
    }
  }

  return best;
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                         */
/* ------------------------------------------------------------------ */

export type PeriodTotals = {
  productiveHours: number;
  neutralHours: number;
  wastedHours: number;
  sleepHours: number;
  /** Days in the period that actually have a log. */
  loggedDays: number;
};

/**
 * Signal share: productive / (productive + waste), as a percentage.
 *
 * Computed over *summed* hours for the period rather than by averaging each
 * day's ratio — an average of per-day ratios is dominated by days with almost
 * no waste, and a raw prod/waste ratio is unbounded when waste is zero.
 * A share is bounded 0–100 and always comparable between periods.
 */
export function signalShare(totals: {
  productiveHours: number;
  wastedHours: number;
}): number | null {
  const denom = totals.productiveHours + totals.wastedHours;
  if (denom <= 0) return null;
  return (totals.productiveHours / denom) * 100;
}

/** Average nightly sleep across days that actually recorded sleep. */
export function averageSleep(sleepHours: (number | null)[]): number | null {
  const valid = sleepHours.filter((v): v is number => v != null && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/** Percent change from `previous` to `current`; null when there's no baseline. */
export function percentChange(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------------ */
/* Visual timeline                                                    */
/* ------------------------------------------------------------------ */

export type TimelineSegment = {
  category: EventCategory;
  /** Minutes from midnight. */
  start: number;
  end: number;
};

/**
 * Collapse the painted canvas into contiguous runs, for the 24-hour ribbon.
 * Unpainted minutes come back as "untracked" so the ribbon always spans the
 * full day and unaccounted time is visible rather than blank.
 */
export function timelineSegments(events: TimelineEvent[]): TimelineSegment[] {
  const canvas = paintTimeline(events);
  const segments: TimelineSegment[] = [];

  let start = 0;
  let current: EventCategory = canvas[0] ?? "untracked";

  for (let m = 1; m <= canvas.length; m++) {
    const cat: EventCategory = canvas[m] ?? "untracked";
    if (m === canvas.length || cat !== current) {
      segments.push({ category: current, start, end: m });
      start = m;
      current = cat;
    }
  }

  return segments;
}
