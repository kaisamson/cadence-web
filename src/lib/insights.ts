// lib/insights.ts
//
// Derived patterns across days. Everything here is computed from data already
// on hand — no new schema — and exists to answer "what should I change?"
// rather than "what happened?".

import type { DaySummary } from "./days";
import { MINUTES_PER_DAY, addDays, timeToMinutes } from "./time";
import { paintTimeline, type TimelineEvent } from "./metrics";

/* ------------------------------------------------------------------ */
/* Logging consistency                                                */
/* ------------------------------------------------------------------ */

export type LoggingStatus = {
  /** Consecutive logged days ending today (or yesterday, if today is unlogged). */
  streak: number;
  /** True when the streak is still alive but today hasn't been recorded. */
  todayMissing: boolean;
  /** Recent unlogged dates, newest first, excluding today. */
  missingRecent: string[];
  /** Share of the last 30 days that have a log, 0–100. */
  coverage30: number;
};

export function loggingStatus(
  logged: Set<string>,
  today: string,
  lookback = 30
): LoggingStatus {
  const todayMissing = !logged.has(today);

  // A streak shouldn't break just because the day isn't over yet, so start
  // counting at yesterday when today is still empty.
  let cursor = todayMissing ? addDays(today, -1) : today;
  let streak = 0;
  while (logged.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const missingRecent: string[] = [];
  let covered = 0;
  for (let i = 0; i < lookback; i++) {
    const date = addDays(today, -i);
    if (logged.has(date)) covered++;
    else if (i > 0) missingRecent.push(date);
  }

  return {
    streak,
    todayMissing,
    missingRecent,
    coverage30: Math.round((covered / lookback) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Unexplained gaps                                                   */
/* ------------------------------------------------------------------ */

export type Gap = { start: number; end: number; minutes: number };

/**
 * Stretches of a day no event accounts for, longest first.
 *
 * Ignores the small hours by default: nobody needs prompting about 3am, and
 * unlogged pre-wake time is almost always just sleep the recap didn't mention.
 */
export function findGaps(
  events: TimelineEvent[],
  { minMinutes = 45, notBefore = 6 * 60 }: { minMinutes?: number; notBefore?: number } = {}
): Gap[] {
  const canvas = paintTimeline(events);
  const gaps: Gap[] = [];

  let start: number | null = null;
  for (let m = 0; m <= MINUTES_PER_DAY; m++) {
    const empty = m < MINUTES_PER_DAY && canvas[m] === null;
    if (empty && start === null) start = m;
    else if (!empty && start !== null) {
      const clipped = Math.max(start, notBefore);
      if (m - clipped >= minMinutes) {
        gaps.push({ start: clipped, end: m, minutes: m - clipped });
      }
      start = null;
    }
  }

  return gaps.sort((a, b) => b.minutes - a.minutes);
}

/* ------------------------------------------------------------------ */
/* Day-of-week pattern                                                */
/* ------------------------------------------------------------------ */

export type WeekdayStat = {
  weekday: string;
  index: number;
  signalHours: number;
  noiseHours: number;
  samples: number;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Average signal and noise per weekday, to expose recurring weekly shape. */
export function weekdayPattern(days: DaySummary[]): WeekdayStat[] {
  const buckets = WEEKDAY_NAMES.map((weekday, index) => ({
    weekday,
    index,
    signal: 0,
    noise: 0,
    samples: 0,
  }));

  for (const day of days) {
    const idx = new Date(`${day.date}T00:00:00`).getDay();
    const b = buckets[idx];
    b.signal += day.metrics.productiveHours;
    b.noise += day.metrics.wastedHours;
    b.samples++;
  }

  return buckets.map((b) => ({
    weekday: b.weekday,
    index: b.index,
    signalHours: b.samples ? b.signal / b.samples : 0,
    noiseHours: b.samples ? b.noise / b.samples : 0,
    samples: b.samples,
  }));
}

/* ------------------------------------------------------------------ */
/* Wake-time consistency                                              */
/* ------------------------------------------------------------------ */

export type WakeConsistency = {
  /** Minutes from midnight. */
  median: number | null;
  earliest: number | null;
  latest: number | null;
  /** Standard deviation in minutes — the number worth reducing. */
  spreadMinutes: number | null;
  samples: number;
};

/**
 * Consistency of wake time, using each day's main sleep block so that naps
 * can't masquerade as a wake-up.
 */
export function wakeConsistency(days: DaySummary[]): WakeConsistency {
  const wakes = days
    .map((d) => d.metrics.mainSleepEnd)
    .filter((v): v is number => v != null);

  if (wakes.length === 0) {
    return { median: null, earliest: null, latest: null, spreadMinutes: null, samples: 0 };
  }

  const sorted = [...wakes].sort((a, b) => a - b);
  const mean = wakes.reduce((a, b) => a + b, 0) / wakes.length;
  const variance = wakes.reduce((a, b) => a + (b - mean) ** 2, 0) / wakes.length;

  return {
    median: sorted[Math.floor(sorted.length / 2)],
    earliest: sorted[0],
    latest: sorted[sorted.length - 1],
    spreadMinutes: Math.round(Math.sqrt(variance)),
    samples: wakes.length,
  };
}

/* ------------------------------------------------------------------ */
/* Noise leaks                                                        */
/* ------------------------------------------------------------------ */

export type Leak = { label: string; hours: number; occurrences: number };

/** The recurring things that eat the most time, grouped by label. */
export function topLeaks(days: DaySummary[], limit = 5): Leak[] {
  const totals = new Map<string, { minutes: number; count: number }>();

  for (const day of days) {
    for (const event of day.events) {
      if (event.category !== "waste") continue;
      const start = timeToMinutes(event.startTime);
      const end = timeToMinutes(event.endTime);
      if (start == null || end == null || end <= start) continue;

      // Collapse near-duplicate labels ("Phone scrolling" vs "phone scrolling").
      const key = event.label.trim().toLowerCase();
      const prev = totals.get(key) ?? { minutes: 0, count: 0 };
      totals.set(key, { minutes: prev.minutes + (end - start), count: prev.count + 1 });
    }
  }

  return [...totals.entries()]
    .map(([label, v]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      hours: v.minutes / 60,
      occurrences: v.count,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, limit);
}
