// lib/pursuits.ts
//
// Replaces the hardcoded `ilike('label','gym%')` counter, which matched 4 of
// roughly 20 real training sessions — every "Driving range", "Golf practice"
// and "Golf at the range" was invisible.
//
// A pursuit is a named thing you're trying to do more of, matched against event
// labels by keyword. Keywords are user-editable, so this generalises instead of
// hardcoding one activity.

import type { DaySummary } from "./days";
import { timeToMinutes } from "./time";

export type Pursuit = {
  id: string;
  name: string;
  /** Case-insensitive substrings; any match counts the event. */
  keywords: string[];
};

/** Seeded from what actually appears in the log. Editable in the UI. */
export const DEFAULT_PURSUITS: Pursuit[] = [
  { id: "golf", name: "Golf", keywords: ["golf", "driving range", "range"] },
  { id: "gym", name: "Gym", keywords: ["gym", "workout", "lift", "training"] },
  { id: "build", name: "Building", keywords: ["cod", "app", "project", "annotat"] },
  { id: "study", name: "Studying", keywords: ["stud", "school", "assignment", "homework"] },
];

export type PursuitStat = {
  pursuit: Pursuit;
  /** Days on which the pursuit happened at all — the honest "sessions" count. */
  sessionDays: number;
  hours: number;
  /** Most recent date it appeared, or null. */
  lastSeen: string | null;
};

function matches(label: string, keywords: string[]): boolean {
  const haystack = label.toLowerCase();
  return keywords.some((k) => k.trim() && haystack.includes(k.trim().toLowerCase()));
}

/**
 * Sessions and hours per pursuit over the given days.
 *
 * Counted per *day*, not per event: the model often splits one gym trip into
 * several blocks, and the old counter reported that as several sessions.
 */
export function pursuitStats(days: DaySummary[], pursuits: Pursuit[]): PursuitStat[] {
  return pursuits.map((pursuit) => {
    let minutes = 0;
    let sessionDays = 0;
    let lastSeen: string | null = null;

    for (const day of days) {
      let dayMinutes = 0;

      for (const event of day.events) {
        if (event.category === "sleep") continue;
        if (!matches(event.label, pursuit.keywords)) continue;

        const start = timeToMinutes(event.startTime);
        const end = timeToMinutes(event.endTime);
        if (start == null || end == null || end <= start) continue;
        dayMinutes += end - start;
      }

      if (dayMinutes > 0) {
        minutes += dayMinutes;
        sessionDays++;
        if (!lastSeen || day.date > lastSeen) lastSeen = day.date;
      }
    }

    return { pursuit, sessionDays, hours: minutes / 60, lastSeen };
  });
}

export function isPursuitArray(value: unknown): value is Pursuit[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as Pursuit).id === "string" &&
        typeof (p as Pursuit).name === "string" &&
        Array.isArray((p as Pursuit).keywords)
    )
  );
}
