// app/api/analyze-day/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuthorized } from "@/lib/apiAuth";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const OWNER_ID = process.env.OWNER_ID!;

type DayEvent = {
  label: string;
  category: "productive" | "neutral" | "waste" | "sleep" | "untracked";
  startTime: string;
  endTime: string;
  notes?: string;
};

type DayMetrics = {
  productiveHours: number;
  neutralHours: number;
  wastedHours: number;
  sleepHours: number;
  focusBlocks: number;
  contextSwitches: number;
};

type DayAnalysis = {
  date: string; // YYYY-MM-DD
  events: DayEvent[];
  summary: string;
  metrics: DayMetrics;
  suggestions: string[];
};

type AnalyzeDayBody = {
  date?: string;
  transcript?: string;
  nowLocalTime?: string; // "HH:MM" local time when the recap was sent
};

/* ------------------------------------------------------------------ */
/* Helpers: time conversion + prev-day sleep propagation              */
/* ------------------------------------------------------------------ */

function parseTimeToMinutes(time: string | undefined | null): number | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToHHMM(totalMinutes: number): string {
  // Clamp to [0, 23:59] so we never try to store "24:00" in Postgres time
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Normalize sleep so that, for THIS calendar day:
 * - We only keep the part of sleep that lies between 00:00 and 24:00.
 * - If sleep crosses midnight (e.g. 23:00–07:00), this day only gets 00:00–07:00.
 * - For cross-midnight sleep, we force startTime to "00:00" for this date so the
 *   timeline always shows sleep starting at midnight.
 *
 * Sleep hours metric rule:
 * - SleepHours for THIS day = ONLY the first sleep block that ends in this day
 *   (the block with the earliest end time after 00:00).
 * - Naps or later sleep blocks on the same date do NOT contribute to sleepHours.
 *   They stay in the timeline but are ignored in the metric.
 */
function normalizeSleepForDay(analysis: DayAnalysis): DayAnalysis {
  const DAY_START = 0; // 00:00 in minutes
  const DAY_END = 24 * 60; // logical 24:00 boundary

  const newEvents: DayEvent[] = [];

  // Sleep segments that actually overlap THIS day (after clipping)
  type SleepSegment = {
    startMinutes: number;
    endMinutes: number;
  };
  const sleepSegments: SleepSegment[] = [];

  for (const ev of analysis.events) {
    if (ev.category !== "sleep") {
      // Non-sleep events are just passed through unchanged
      newEvents.push(ev);
      continue;
    }

    const startM = parseTimeToMinutes(ev.startTime);
    const endM = parseTimeToMinutes(ev.endTime);

    if (startM == null || endM == null) {
      // Keep it for the timeline, but we can't use it for metrics
      newEvents.push(ev);
      continue;
    }

    if (startM <= endM) {
      // Same-day sleep (e.g. 01:00–08:00, or a nap 14:00–15:00)
      const clippedStart = Math.max(startM, DAY_START);
      const clippedEnd = Math.min(endM, DAY_END);

      if (clippedEnd > clippedStart) {
        newEvents.push({
          ...ev,
          startTime: minutesToHHMM(clippedStart),
          endTime: minutesToHHMM(clippedEnd),
        });

        sleepSegments.push({
          startMinutes: clippedStart,
          endMinutes: clippedEnd,
        });
      }
      // If fully outside this day, we drop it for this date.
    } else {
      // Cross-midnight sleep (e.g. 23:00–07:00):
      // For THIS date, we keep only 00:00–endM.
      const clippedStart = DAY_START; // always midnight for this day
      const clippedEnd = Math.min(endM, DAY_END);

      if (clippedEnd > clippedStart) {
        newEvents.push({
          ...ev,
          startTime: minutesToHHMM(clippedStart), // "00:00"
          endTime: minutesToHHMM(clippedEnd),
        });

        sleepSegments.push({
          startMinutes: clippedStart,
          endMinutes: clippedEnd,
        });
      }
    }
  }

  // 🔑 Only count the FIRST sleep block that ends in this day:
  // i.e., the sleep segment whose endMinutes is earliest after 00:00.
  let sleepMinutesForThisDay = 0;

  if (sleepSegments.length > 0) {
    const mainSegment = sleepSegments.reduce((earliest, seg) => {
      if (!earliest) return seg;
      return seg.endMinutes < earliest.endMinutes ? seg : earliest;
    });

    sleepMinutesForThisDay = Math.max(
      0,
      mainSegment.endMinutes - mainSegment.startMinutes
    );
  }

  const sleepHours = sleepMinutesForThisDay / 60;

  return {
    ...analysis,
    events: newEvents,
    metrics: {
      ...analysis.metrics,
      // override with our deterministic calculation:
      // - this day's "first sleep hours" (morning block only)
      sleepHours,
    },
  };
}



type PrevDaySleepSegment = {
  startMinutes: number; // between 0 and 1440
  endMinutes: number; // for us this will be DAY_END=1440
};

/**
 * Extract how much of the model's sleep should belong to the PREVIOUS day.
 * For a cross-midnight event like 23:00–07:00, previous day gets 23:00–24:00.
 */
function extractPrevDaySleepSegments(raw: DayAnalysis): PrevDaySleepSegment[] {
  const DAY_END = 24 * 60;
  const segments: PrevDaySleepSegment[] = [];

  for (const ev of raw.events) {
    if (ev.category !== "sleep") continue;

    const startM = parseTimeToMinutes(ev.startTime);
    const endM = parseTimeToMinutes(ev.endTime);
    if (startM == null || endM == null) continue;

    if (startM > endM) {
      // Cross-midnight sleep: previous day gets [startM, 24:00)
      segments.push({ startMinutes: startM, endMinutes: DAY_END });
    }
  }

  return segments;
}

function getPreviousDateString(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Given cross-midnight sleep segments for THIS date, apply their "tail" to the
 * PREVIOUS day:
 * - Update previous day's metrics.sleep_hours by adding those minutes.
 * - Insert/update a "Sleep (carryover to <date>)" event at the end of previous day.
 */
async function applyPrevDaySleepPatch(
  ownerId: string,
  thisDate: string,
  segments: PrevDaySleepSegment[]
) {
  if (segments.length === 0) return;

  const prevDate = getPreviousDateString(thisDate);

  // 1) Find or create previous day row
  const { data: prevDayRow, error: prevDayError } = await supabaseAdmin
    .from("days")
    .select("id, metrics_id")
    .eq("user_id", ownerId)
    .eq("date", prevDate)
    .maybeSingle();

  let prevDayId: string;
  let prevMetricsId: string | null = null;

  if (prevDayError) {
    console.error("Error selecting previous day", prevDayError);
    throw prevDayError;
  }

  if (!prevDayRow) {
    // Create a stub previous day row if it doesn't exist
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("days")
      .insert({
        user_id: ownerId,
        date: prevDate,
        transcript: "",
        summary: null,
        suggestions: null,
      })
      .select("id, metrics_id")
      .single();

    if (insertError || !inserted) {
      console.error("Error inserting previous day stub", insertError);
      throw insertError || new Error("Missing prev day row");
    }
    prevDayId = inserted.id;
    prevMetricsId = inserted.metrics_id ?? null;
  } else {
    prevDayId = prevDayRow.id;
    prevMetricsId = prevDayRow.metrics_id ?? null;
  }

  // 2) Compute total extra sleep minutes for previous day
  const extraMinutes = segments.reduce(
    (sum, seg) => sum + Math.max(0, seg.endMinutes - seg.startMinutes),
    0
  );
  const extraHours = extraMinutes / 60;

  // 3) Upsert metrics for previous day (add to existing sleep_hours)
  let prevMetrics = null;
  if (prevMetricsId) {
    const { data: metricsRow, error: metricsError } = await supabaseAdmin
      .from("metrics")
      .select("*")
      .eq("id", prevMetricsId)
      .maybeSingle();

    if (metricsError) {
      console.error("Error selecting previous metrics", metricsError);
      throw metricsError;
    }

    if (metricsRow) {
      prevMetrics = metricsRow;
    }
  }

  const newSleepHours =
    (prevMetrics?.sleep_hours ? Number(prevMetrics.sleep_hours) : 0) +
    extraHours;

  const { data: upsertedMetrics, error: upsertMetricsError } =
    await supabaseAdmin
      .from("metrics")
      .upsert(
        {
          day_id: prevDayId,
          productive_hours: prevMetrics?.productive_hours ?? null,
          neutral_hours: prevMetrics?.neutral_hours ?? null,
          wasted_hours: prevMetrics?.wasted_hours ?? null,
          sleep_hours: newSleepHours,
          focus_blocks: prevMetrics?.focus_blocks ?? null,
          context_switches: prevMetrics?.context_switches ?? null,
        },
        { onConflict: "day_id" }
      )
      .select()
      .single();

  if (upsertMetricsError || !upsertedMetrics) {
    console.error("Error upserting previous day metrics", upsertMetricsError);
    throw upsertMetricsError || new Error("Missing prev metrics");
  }

  // 4) Make sure days.metrics_id points at the metrics row
  if (!prevMetricsId || prevMetricsId !== upsertedMetrics.id) {
    const { error: linkError } = await supabaseAdmin
      .from("days")
      .update({ metrics_id: upsertedMetrics.id })
      .eq("id", prevDayId);

    if (linkError) {
      console.error("Error linking prev day to metrics", linkError);
      throw linkError;
    }
  }

  // 5) Insert or replace a carryover sleep event at the end of previous day
  const earliestStart = Math.min(...segments.map((s) => s.startMinutes));
  const carryLabel = `Sleep (carryover to ${thisDate})`;

  // Delete any previous carryover event with same label so we don't stack duplicates
  const { error: deleteError } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("day_id", prevDayId)
    .eq("user_id", ownerId)
    .eq("label", carryLabel);

  if (deleteError) {
    console.error("Error deleting old carryover sleep events", deleteError);
  }

  const startTimeStr = minutesToHHMM(earliestStart);
  const endTimeStr = minutesToHHMM(24 * 60 - 1); // 23:59 for UI, but metrics used full hour count

  const { error: insertEventError } = await supabaseAdmin.from("events").insert({
    day_id: prevDayId,
    user_id: ownerId,
    label: carryLabel,
    category: "sleep",
    start_time: startTimeStr,
    end_time: endTimeStr,
    notes: "Auto-filled sleep from night before this day",
  });

  if (insertEventError) {
    console.error("Error inserting carryover sleep event", insertEventError);
    // Not fatal for the request; metrics already updated.
  }
}

/* ------------------------------------------------------------------ */
/* Main handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  if (!verifyRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      return NextResponse.json(
        { error: "Supabase env vars not set" },
        { status: 500 }
      );
    }
    if (!OWNER_ID) {
      return NextResponse.json(
        { error: "OWNER_ID not set" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as AnalyzeDayBody;
    const { date, transcript, nowLocalTime } = body;

    if (!date || !transcript) {
      return NextResponse.json(
        { error: "Missing date or transcript" },
        { status: 400 }
      );
    }

    // 1) Load existing day (for merge behavior)
    const {
      data: existingDayRow,
      error: existingDayError,
    } = await supabaseAdmin
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
      .eq("user_id", OWNER_ID)
      .eq("date", date)
      .maybeSingle();

    if (existingDayError) {
      console.error("Error selecting existing day", existingDayError);
      throw existingDayError;
    }

    // Build transcript history as a list
    let existingTranscriptList: string[] = [];
    if (existingDayRow && existingDayRow.transcript) {
      const t = existingDayRow.transcript as any;
      if (Array.isArray(t)) {
        existingTranscriptList = t.filter(
          (entry: any): entry is string => typeof entry === "string"
        );
      } else if (typeof t === "string" && t.trim().length > 0) {
        existingTranscriptList = [t];
      }
    }

    const updatedTranscriptList = [...existingTranscriptList, transcript];

    let existingEvents: any[] = [];
    if (existingDayRow) {
      const { data: eventRows, error: eventsError } = await supabaseAdmin
        .from("events")
        .select("id, label, category, start_time, end_time, notes")
        .eq("day_id", existingDayRow.id)
        .order("start_time", { ascending: true });

      if (eventsError) {
        console.error("Error selecting existing events", eventsError);
        throw eventsError;
      }
      existingEvents = eventRows ?? [];
    }

    const existingMetrics = existingDayRow?.metrics
      ? Array.isArray(existingDayRow.metrics)
        ? existingDayRow.metrics[0]
        : existingDayRow.metrics
      : null;

    const existingStructured = existingDayRow
      ? {
          date: existingDayRow.date,
          summary: existingDayRow.summary ?? "",
          suggestions: existingDayRow.suggestions ?? [],
          transcript: existingTranscriptList, // history for the model
          metrics: existingMetrics
            ? {
                productiveHours: Number(
                  existingMetrics.productive_hours ?? 0
                ),
                neutralHours: Number(existingMetrics.neutral_hours ?? 0),
                wastedHours: Number(existingMetrics.wasted_hours ?? 0),
                sleepHours: Number(existingMetrics.sleep_hours ?? 0),
                focusBlocks: Number(existingMetrics.focus_blocks ?? 0),
                contextSwitches: Number(
                  existingMetrics.context_switches ?? 0
                ),
              }
            : null,
          events: existingEvents.map((e) => ({
            label: e.label,
            category: e.category,
            startTime: e.start_time,
            endTime: e.end_time,
            notes: e.notes ?? "",
          })),
        }
      : null;

    const existingJson = JSON.stringify(existingStructured);

    const systemPrompt = `
You are Cadence, a life optimization assistant.

You are given:
- a date (YYYY-MM-DD)
- the existing structured state for that day (may be null)
- a new recap or corrections from the user

Your job is to output the FINAL updated structured state for that day, as a JSON object
matching this schema:

{
  "date": "YYYY-MM-DD",
  "events": [
    {
      "label": "string",
      "category": "productive" | "neutral" | "waste" | "sleep" | "untracked",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "notes": "optional string"
    }
  ],
  "summary": "string",
  "metrics": {
    "productiveHours": number,
    "neutralHours": number,
    "wastedHours": number,
    "sleepHours": number,
    "focusBlocks": number,
    "contextSwitches": number
  },
  "suggestions": ["string"]
}

Update rules:

1) EDIT, DON'T RESET
- If an existing structured day is provided, treat the new recap as CORRECTIONS and ADDITIONS.
- Merge the new information into the existing state instead of discarding it.
- Preserve events and details that are not contradicted or changed by the new recap.
- If the user clarifies that something happened at a different time, update that event's times.
- If the user adds new activities, insert new events in the correct place in the day.

2) SLEEP & DAY BOUNDARY
- It's common for the user to describe sleep that crosses midnight (e.g. "I went to bed at 23:00 and woke up at 07:00").
- In those cases, represent sleep as a single event that spans from the bedtime to the wake time, even if that means startTime > endTime
  (e.g. "startTime": "23:00", "endTime": "07:00").
- The server will handle splitting this sleep across the previous and current days. You do NOT need to worry about which day owns which hours.
- If the user ONLY mentions when they went to bed (e.g. "I went to bed at 23:00" / "I went to bed at 11pm") and does NOT mention when they woke up yet,
  then:
  - Treat that as sleep from the mentioned bedtime until the end of that calendar day (23:59).
  - Do NOT create a cross-midnight sleep block in that case.
  - Later, when the user describes when they woke up the next day, you can adjust the previous night's sleep then.


3) OVERLAPPING / STACKED EVENTS
- If the user describes doing two things at once (e.g. studying while checking their phone every 10 minutes),
  create overlapping or stacked events to reflect both activities.
- For example, you might have a "study" block from 13:00–15:00 and several small "phone scrolling" blocks inside that range.

4) UNTRACKED GAPS
- Look for significant gaps between events (for example, longer than 30–60 minutes) where the user did not explain what happened.
- Fill these gaps with events whose category is "untracked".
- For "untracked" events:
  - Use startTime and endTime to cover the gap.
  - Add a short, cautious note guessing what might have happened based on the rest of the day (e.g. "likely commute / misc downtime"),
    but keep the category "untracked".
- Untracked events should help the timeline cover roughly the whole day so there are not huge empty holes.

5) METRICS VS UNTRACKED
- Even though "untracked" events exist, the metrics should still assign time into one of: productive, neutral, waste, sleep.
- In other words: think about how the untracked time would most likely be spent and reflect that in the metrics, but keep the event category "untracked"
  so it's clear that this block is inferred.

6) CURRENT LOCAL TIME & RELATIVE PHRASES
- You will be given the user's current local time when they sent this recap, as "nowLocalTime" in HH:MM (24h) format.
- If the user uses relative phrases like "just now", "for the last 20 minutes", "the past hour", or "right before this",
  interpret them relative to nowLocalTime.
  - Example: if nowLocalTime = "14:00" and the user says "I just went on my phone for 20 minutes",
    create an event from 13:40 to 14:00.
- If a relative phrase would push the start time before 00:00 of that date, clamp the start time at "00:00".
- If no clear duration is given for a "just now" phrase, assume a short reasonable block (e.g., 10–20 minutes) based on the rest of the day.

7) GENERAL RULES
- Infer rough times from context if possible; otherwise approximate.
- Be consistent: total hours across categories in metrics should roughly add to 24.
- Focus on realistic, actionable suggestions (no fluff).
- Respond with ONLY valid JSON, no commentary.
    `.trim();

    const nowLine = nowLocalTime
      ? `Current local time when this recap was sent: ${nowLocalTime}.\n`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            `Date: ${date}\n` +
            nowLine +
            `Existing structured day (may be null):\n${existingJson}\n\n` +
            `New recap or corrections:\n${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Empty completion from model" },
        { status: 500 }
      );
    }

    const rawAnalysis = JSON.parse(raw) as DayAnalysis;

    // 🔁 3a) Extract sleep that belongs to PREVIOUS day
    const prevSleepSegments = extractPrevDaySleepSegments(rawAnalysis);

    // 🔁 3b) Normalize sleep for THIS day and recompute sleepHours
    const analysis = normalizeSleepForDay(rawAnalysis);

    // 🔁 3c) Apply patch to previous day (sleep tail, metrics, carryover event)
    if (prevSleepSegments.length > 0) {
      await applyPrevDaySleepPatch(OWNER_ID, analysis.date, prevSleepSegments);
    }

    // 4) Ensure owner exists in public.users (mirror of auth user)
    const { data: existingUser, error: userSelectError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", OWNER_ID)
      .maybeSingle();

    if (userSelectError) {
      console.error("Error selecting user", userSelectError);
      throw userSelectError;
    }

    if (!existingUser) {
      const { error: userInsertError } = await supabaseAdmin
        .from("users")
        .insert({
          id: OWNER_ID,
          email: "owner@example.com", // placeholder; real email lives in auth.users
        });

      if (userInsertError) {
        console.error("Error inserting owner user", userInsertError);
        throw userInsertError;
      }
    }

    // 5) Upsert day (unique per user + date)
    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("days")
      .upsert(
        {
          user_id: OWNER_ID,
          date: analysis.date,
          transcript: updatedTranscriptList, // store full history
          summary: analysis.summary,
          suggestions: analysis.suggestions,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (dayError || !dayRow) {
      console.error("Error upserting day", dayError);
      throw dayError || new Error("Missing dayRow");
    }

    // 6) Upsert metrics for this day (with normalized sleepHours)
    const { data: metricsRow, error: metricsError } = await supabaseAdmin
      .from("metrics")
      .upsert(
        {
          day_id: dayRow.id,
          productive_hours: analysis.metrics.productiveHours,
          neutral_hours: analysis.metrics.neutralHours,
          wasted_hours: analysis.metrics.wastedHours,
          sleep_hours: analysis.metrics.sleepHours,
          focus_blocks: analysis.metrics.focusBlocks,
          context_switches: analysis.metrics.contextSwitches,
        },
        { onConflict: "day_id" }
      )
      .select()
      .single();

    if (metricsError || !metricsRow) {
      console.error("Error upserting metrics", metricsError);
      throw metricsError || new Error("Missing metricsRow");
    }

    // 7) Attach metrics_id to day if missing / changed
    if (dayRow.metrics_id !== metricsRow.id) {
      const { error: dayUpdateError } = await supabaseAdmin
        .from("days")
        .update({ metrics_id: metricsRow.id })
        .eq("id", dayRow.id);

      if (dayUpdateError) {
        console.error("Error updating day.metrics_id", dayUpdateError);
        throw dayUpdateError;
      }
    }

    // 8) Replace events for this day with the UPDATED set from analysis
    const { error: deleteEventsError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("day_id", dayRow.id);

    if (deleteEventsError) {
      console.error("Error deleting existing events", deleteEventsError);
      throw deleteEventsError;
    }

    if (analysis.events.length > 0) {
      const eventInserts = analysis.events.map((e) => ({
        day_id: dayRow.id,
        user_id: OWNER_ID,
        label: e.label,
        category: e.category,
        start_time: e.startTime || null,
        end_time: e.endTime || null,
        notes: e.notes ?? null,
      }));

      const { error: eventsInsertError } = await supabaseAdmin
        .from("events")
        .insert(eventInserts);

      if (eventsInsertError) {
        console.error("Error inserting events", eventsInsertError);
        throw eventsInsertError;
      }
    }

    // 9) Return analysis + day id + transcript history.
    // Order: date, events, summary, metrics, suggestions, transcript
    return NextResponse.json({
      dayId: dayRow.id,
      date: analysis.date,
      events: analysis.events,
      summary: analysis.summary,
      metrics: analysis.metrics,
      suggestions: analysis.suggestions,
      transcript: updatedTranscriptList,
    });
  } catch (err: any) {
    console.error("analyze-day error", err);
    return NextResponse.json(
      {
        error: "Internal error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
