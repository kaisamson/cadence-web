// lib/days.ts
//
// Read layer for days and events.
//
// Metrics are recomputed from events on every read rather than read from the
// `metrics` table. The stored values were produced by the model and are wrong
// for historical rows; deriving them here corrects the entire back catalogue
// without a migration, and guarantees the numbers always match the timeline
// the user is looking at.

import { supabaseAdmin } from "./supabaseAdmin";
import { computeMetrics, type DerivedMetrics, type TimelineEvent } from "./metrics";
import { parseTranscriptHistory } from "./transcript";
import { hhmm } from "./time";

const OWNER_ID = process.env.OWNER_ID!;

export type DayEvent = {
  id: string;
  label: string;
  category: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
};

export type DayRecord = {
  id: string;
  date: string;
  summary: string | null;
  suggestions: string[];
  /** Every recap recorded for this day, oldest first. */
  transcripts: string[];
  events: DayEvent[];
  metrics: DerivedMetrics;
};

export function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

function toTimelineEvents(events: DayEvent[]): TimelineEvent[] {
  return events.map((e) => ({
    label: e.label,
    category: e.category,
    startTime: e.startTime,
    endTime: e.endTime,
    notes: e.notes,
  }));
}

function mapEventRow(row: Record<string, unknown>): DayEvent {
  return {
    id: row.id as string,
    label: row.label as string,
    category: (row.category as string) ?? "untracked",
    startTime: hhmm(row.start_time as string | null),
    endTime: hhmm(row.end_time as string | null),
    notes: (row.notes as string | null) ?? null,
  };
}

const DAY_COLUMNS = "id, date, summary, suggestions, transcript";

function buildRecord(
  dayRow: Record<string, unknown>,
  eventRows: Record<string, unknown>[]
): DayRecord {
  const events = eventRows
    .map(mapEventRow)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  return {
    id: dayRow.id as string,
    date: dayRow.date as string,
    summary: (dayRow.summary as string | null) ?? null,
    suggestions: (dayRow.suggestions as string[] | null) ?? [],
    transcripts: parseTranscriptHistory(dayRow.transcript),
    events,
    metrics: computeMetrics(toTimelineEvents(events)),
  };
}

async function loadDay(
  column: "id" | "date",
  value: string
): Promise<DayRecord | null> {
  const { data: dayRow, error } = await supabaseAdmin
    .from("days")
    .select(DAY_COLUMNS)
    .eq("user_id", OWNER_ID)
    .eq(column, value)
    .maybeSingle();

  if (error) {
    console.error(`loadDay(${column}) error`, error);
    return null;
  }
  if (!dayRow) return null;

  const { data: eventRows, error: eventsError } = await supabaseAdmin
    .from("events")
    .select("id, label, category, start_time, end_time, notes")
    .eq("day_id", dayRow.id);

  if (eventsError) console.error("loadDay events error", eventsError);

  return buildRecord(dayRow, (eventRows ?? []) as Record<string, unknown>[]);
}

export async function getDayById(id: string): Promise<DayRecord | null> {
  if (!id || !isUuid(id)) return null;
  return loadDay("id", id);
}

export async function getDayByDate(date: string): Promise<DayRecord | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return loadDay("date", date);
}

/** Lightweight row for list and trend views. */
export type DaySummary = {
  id: string;
  date: string;
  summary: string | null;
  suggestions: string[];
  metrics: DerivedMetrics;
  events: DayEvent[];
};

/**
 * All logged days with derived metrics, newest first.
 *
 * Two queries total — days, then every event for those days — rather than one
 * query per day.
 */
export async function getAllDays(limit = 400): Promise<DaySummary[]> {
  if (!OWNER_ID) throw new Error("OWNER_ID not set");

  const { data: dayRows, error } = await supabaseAdmin
    .from("days")
    .select(DAY_COLUMNS)
    .eq("user_id", OWNER_ID)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getAllDays error", error);
    throw error;
  }

  const days = dayRows ?? [];
  if (days.length === 0) return [];

  const { data: eventRows, error: eventsError } = await supabaseAdmin
    .from("events")
    .select("id, day_id, label, category, start_time, end_time, notes")
    .in(
      "day_id",
      days.map((d) => d.id)
    );

  if (eventsError) console.error("getAllDays events error", eventsError);

  const byDay = new Map<string, Record<string, unknown>[]>();
  for (const row of (eventRows ?? []) as Record<string, unknown>[]) {
    const key = row.day_id as string;
    const list = byDay.get(key);
    if (list) list.push(row);
    else byDay.set(key, [row]);
  }

  return days.map((row) => {
    const record = buildRecord(row, byDay.get(row.id) ?? []);
    return {
      id: record.id,
      date: record.date,
      summary: record.summary,
      suggestions: record.suggestions,
      metrics: record.metrics,
      events: record.events,
    };
  });
}
