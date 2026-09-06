// app/api/analyze-day/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import { verifyRequestAuthorized } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeMetrics, type TimelineEvent } from "@/lib/metrics";
import { DAY_SYSTEM_PROMPT } from "@/lib/dayPrompt";
import {
  parseTranscriptHistory,
  serializeTranscriptHistory,
} from "@/lib/transcript";
import { hhmm } from "@/lib/time";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const OWNER_ID = process.env.OWNER_ID!;
const MODEL = process.env.CADENCE_MODEL || "gpt-4.1-mini";

// A recap is a few sentences; anything vastly larger is a client bug or abuse.
const MAX_TRANSCRIPT_CHARS = 8000;

type ModelEvent = {
  label?: unknown;
  category?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  notes?: unknown;
};

type ModelResponse = {
  date?: unknown;
  events?: unknown;
  summary?: unknown;
  suggestions?: unknown;
};

const VALID_CATEGORIES = new Set([
  "productive",
  "neutral",
  "waste",
  "sleep",
  "untracked",
]);

/**
 * Coerce the model's output into events we can trust. Anything malformed is
 * dropped rather than written, so a bad completion can't corrupt a day.
 */
function sanitizeEvents(raw: unknown): TimelineEvent[] {
  if (!Array.isArray(raw)) return [];

  const events: TimelineEvent[] = [];

  for (const item of raw as ModelEvent[]) {
    if (!item || typeof item !== "object") continue;

    const label = typeof item.label === "string" ? item.label.trim().slice(0, 120) : "";
    const start = hhmm(typeof item.startTime === "string" ? item.startTime : null);
    const end = hhmm(typeof item.endTime === "string" ? item.endTime : null);
    if (!label || !start || !end) continue;
    // Reject inverted spans instead of silently reordering them: a flipped span
    // usually means the model tried to cross midnight, and guessing is worse.
    if (start >= end) continue;

    const rawCategory =
      typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
    const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "untracked";

    const notes =
      typeof item.notes === "string" && item.notes.trim()
        ? item.notes.trim().slice(0, 280)
        : null;

    events.push({ label, category, startTime: start, endTime: end, notes });
  }

  return events.sort((a, b) => (a.startTime! < b.startTime! ? -1 : 1));
}

function sanitizeSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    if (!OWNER_ID) {
      return NextResponse.json({ error: "OWNER_ID not set" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const transcript =
      typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const nowLocalTime =
      typeof body?.nowLocalTime === "string" ? body.nowLocalTime.trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date" }, { status: 400 });
    }
    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return NextResponse.json({ error: "Recap is too long" }, { status: 413 });
    }

    /* ---------------- Load existing state for merging ---------------- */

    const { data: existingDayRow, error: existingDayError } = await supabaseAdmin
      .from("days")
      .select("id, date, transcript, summary, suggestions")
      .eq("user_id", OWNER_ID)
      .eq("date", date)
      .maybeSingle();

    if (existingDayError) throw existingDayError;

    const history = parseTranscriptHistory(existingDayRow?.transcript);
    const updatedHistory = [...history, transcript];

    let existingEvents: TimelineEvent[] = [];
    if (existingDayRow) {
      const { data: eventRows, error: eventsError } = await supabaseAdmin
        .from("events")
        .select("label, category, start_time, end_time, notes")
        .eq("day_id", existingDayRow.id)
        .order("start_time", { ascending: true });

      if (eventsError) throw eventsError;

      existingEvents = (eventRows ?? []).map((e) => ({
        label: e.label as string,
        category: e.category as string,
        startTime: hhmm(e.start_time as string | null),
        endTime: hhmm(e.end_time as string | null),
        notes: (e.notes as string | null) ?? null,
      }));
    }

    const existingState = existingDayRow
      ? {
          date: existingDayRow.date,
          summary: existingDayRow.summary ?? "",
          suggestions: existingDayRow.suggestions ?? [],
          previousRecaps: history,
          events: existingEvents,
        }
      : null;

    /* ---------------- Ask the model for a timeline ---------------- */

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: DAY_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Date: ${date}`,
            nowLocalTime ? `User's current local time: ${nowLocalTime}` : null,
            ``,
            `Existing structured day (may be null):`,
            JSON.stringify(existingState),
            ``,
            `New recap or corrections:`,
            transcript,
          ]
            .filter((line) => line !== null)
            .join("\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    let parsed: ModelResponse;
    try {
      parsed = JSON.parse(raw) as ModelResponse;
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 502 });
    }

    const events = sanitizeEvents(parsed.events);
    if (events.length === 0) {
      return NextResponse.json(
        { error: "Could not build a timeline from that recap. Try adding more detail." },
        { status: 422 }
      );
    }

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : null;
    const suggestions = sanitizeSuggestions(parsed.suggestions);

    // Metrics are derived here, never taken from the model.
    const metrics = computeMetrics(events);

    /* ---------------- Persist ---------------- */

    const { data: existingUser, error: userSelectError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", OWNER_ID)
      .maybeSingle();
    if (userSelectError) throw userSelectError;

    if (!existingUser) {
      const { error: userInsertError } = await supabaseAdmin
        .from("users")
        .insert({ id: OWNER_ID, email: "owner@example.com" });
      if (userInsertError) throw userInsertError;
    }

    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("days")
      .upsert(
        {
          user_id: OWNER_ID,
          date,
          transcript: serializeTranscriptHistory(updatedHistory),
          summary,
          suggestions,
        },
        { onConflict: "user_id,date" }
      )
      .select("id, metrics_id")
      .single();

    if (dayError || !dayRow) throw dayError ?? new Error("Failed to upsert day");

    const { data: metricsRow, error: metricsError } = await supabaseAdmin
      .from("metrics")
      .upsert(
        {
          day_id: dayRow.id,
          productive_hours: metrics.productiveHours,
          neutral_hours: metrics.neutralHours,
          wasted_hours: metrics.wastedHours,
          sleep_hours: metrics.sleepHours,
          focus_blocks: metrics.focusBlocks,
          context_switches: metrics.contextSwitches,
        },
        { onConflict: "day_id" }
      )
      .select("id")
      .single();

    if (metricsError || !metricsRow) {
      throw metricsError ?? new Error("Failed to upsert metrics");
    }

    if (dayRow.metrics_id !== metricsRow.id) {
      const { error: linkError } = await supabaseAdmin
        .from("days")
        .update({ metrics_id: metricsRow.id })
        .eq("id", dayRow.id);
      if (linkError) throw linkError;
    }

    // Replace the event set. Insert first would be ideal, but the day's events
    // have no version column to distinguish generations, so we delete then
    // insert and surface a clear error if the insert half fails.
    const { error: deleteEventsError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("day_id", dayRow.id);
    if (deleteEventsError) throw deleteEventsError;

    const { error: insertEventsError } = await supabaseAdmin.from("events").insert(
      events.map((e) => ({
        day_id: dayRow.id,
        user_id: OWNER_ID,
        label: e.label,
        category: e.category,
        start_time: e.startTime,
        end_time: e.endTime,
        notes: e.notes,
      }))
    );
    if (insertEventsError) throw insertEventsError;

    return NextResponse.json({
      dayId: dayRow.id,
      date,
      events,
      summary,
      suggestions,
      metrics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("analyze-day error", err);
    return NextResponse.json(
      { error: "Could not analyze that day", details: message },
      { status: 500 }
    );
  }
}
