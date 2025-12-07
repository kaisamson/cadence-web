// lib/getDayById.ts
import { supabaseAdmin } from "./supabaseAdmin";

export type Metrics = {
  productive_hours: number | null;
  neutral_hours: number | null;
  wasted_hours: number | null;
  sleep_hours: number | null;
  focus_blocks: number | null;
  context_switches: number | null;
};

export type Event = {
  id: string;
  label: string;
  category: "productive" | "neutral" | "waste" | "sleep" | string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

export type DayDetail = {
  id: string;
  date: string; // YYYY-MM-DD
  transcript: string;
  summary: string | null;
  suggestions: string[] | null;
  metrics: Metrics | null;
  events: Event[];
};

// Basic UUID validation to avoid 22P02 errors from Postgres
export function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value
  );
}

export async function getDayById(id: string): Promise<DayDetail | null> {
  if (!id || id === "undefined") {
    console.warn("getDayById: missing or 'undefined' id");
    return null;
  }

  if (!isUuid(id)) {
    console.warn("getDayById: invalid UUID slug", id);
    return null;
  }

  // Fetch the day by primary key ONLY
  const { data: dayData, error: dayError } = await supabaseAdmin
    .from("days")
    .select(
      `
        id,
        date,
        transcript,
        summary,
        suggestions,
        metrics:metrics_id (
          productive_hours,
          neutral_hours,
          wasted_hours,
          sleep_hours,
          focus_blocks,
          context_switches
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (dayError) {
    console.error("getDayById dayError", dayError);
    return null;
  }

  if (!dayData) {
    console.warn("getDayById: no day found for id", id);
    return null;
  }

  const rawMetrics = (dayData as any).metrics;
  const metrics: Metrics | null = Array.isArray(rawMetrics)
    ? (rawMetrics[0] ?? null)
    : (rawMetrics ?? null);

  const dayId: string = dayData.id as string;

  const { data: eventsData, error: eventsError } = await supabaseAdmin
    .from("events")
    .select(
      `
        id,
        label,
        category,
        start_time,
        end_time,
        notes
      `
    )
    .eq("day_id", dayId)
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("getDayById eventsError", eventsError);
  }

  const events: Event[] = (eventsData ?? []).map((e) => ({
    id: e.id as string,
    label: e.label as string,
    category: (e.category as Event["category"]) ?? "neutral",
    start_time: (e.start_time as string | null) ?? null,
    end_time: (e.end_time as string | null) ?? null,
    notes: (e.notes as string | null) ?? null,
  }));

  return {
    id: dayId,
    date: dayData.date as string,
    transcript: dayData.transcript as string,
    summary: (dayData.summary as string | null) ?? null,
    suggestions: (dayData.suggestions as string[] | null) ?? null,
    metrics,
    events,
  };
}
