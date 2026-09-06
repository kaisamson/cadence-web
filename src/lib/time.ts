// lib/time.ts
// Local-timezone date helpers. Everything in Cadence is anchored to the user's
// local day, never UTC — logging an evening recap must not roll over to tomorrow.

export const MINUTES_PER_DAY = 24 * 60;

/** YYYY-MM-DD for a Date, in local time. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date string, in the viewer's local timezone. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** Parse YYYY-MM-DD into a local-midnight Date (never UTC-shifted). */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

/** Current local wall-clock time as HH:MM — sent to the model so that
 *  "just now" and "for the last 20 minutes" resolve correctly. */
export function nowLocalTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Clock times                                                        */
/* ------------------------------------------------------------------ */

/** Postgres `time` columns come back as "HH:MM:SS"; the model emits "HH:MM". */
export function hhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(t: string | null | undefined): number | null {
  const norm = hhmm(t);
  if (!norm) return null;
  const [h, m] = norm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "05:00:00" -> "5:00 AM" */
export function formatClock(t: string | null | undefined): string {
  const mins = timeToMinutes(t);
  if (mins == null) return "--:--";
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 150 -> "2h 30m", 45 -> "45m", 120 -> "2h" */
export function formatDuration(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHours(value: number | null | undefined): string {
  if (value == null) return "–";
  return `${value.toFixed(1)}h`;
}

/* ------------------------------------------------------------------ */
/* Calendar display                                                   */
/* ------------------------------------------------------------------ */

export function formatDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatWeekday(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

/** Human label for a date relative to today: "Today", "Yesterday", or a date. */
export function relativeDayLabel(dateStr: string, today = todayStr()): string {
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  if (dateStr === addDays(today, 1)) return "Tomorrow";
  return formatDate(dateStr);
}

/** Sunday that starts the week containing `dateStr`. */
export function startOfWeek(dateStr: string): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

/** The seven date strings of the week beginning at `weekStart` (a Sunday). */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** The last `n` date strings ending with today. */
export function lastNDates(n: number, end = todayStr()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)));
}
