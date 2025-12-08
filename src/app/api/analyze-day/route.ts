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
    You are Cadence, a life optimization assistant with a strict "signal vs noise" mindset.

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

    0) ACTIVITY CATEGORIES (STRICT, SIGNAL VS NOISE)

    Think in terms of "signal vs noise" like a ruthless founder:

    - "productive" = SIGNAL: time that clearly moves life forward
      - Studying for school, doing assignments, deep work on business, coding, writing, hard learning.
      - Gym / structured workouts done with the intention of health/performance improvement.
      - Focused planning, journaling, reflection directly tied to goals.
      - Career-building work (portfolio, applications, interview prep, networking that is clearly intentional).

    - "neutral" = NECESSARY MAINTENANCE:
      - Things that are required to keep life running but are not direct progress:
        - Commuting, cooking, eating, cleaning, laundry, hygiene.
        - Admin tasks (banking, paperwork, errands, appointments).
      - These are not "good" or "bad" — they are infrastructure.

    - "waste" = NOISE: anything that is primarily entertainment / distraction / avoidance.
      - Scrolling social media, TikTok, Instagram, YouTube, Reddit, doomscrolling.
      - TV, Netflix, movies, anime, Twitch, non-intentional content consumption.
      - Video games (unless explicitly for job/portfolio reasons).
      - Mindless web browsing, checking notifications, random texting with no clear purpose.
      - Hanging out in a way that is clearly "killing time" rather than meaningful connection.
      - When in doubt between "neutral" and "waste", default to "waste".
      - If something is partly productive but heavily diluted with distractions (e.g. "studying but mostly on my phone"),
        treat most of that time as "waste" and only carve out clearly focused blocks as "productive".

    - "sleep":
      - Only actual sleep (night sleep and naps).
      - Sleep has its own metric (sleepHours) and should not be mixed with other categories.

    - "untracked":
      - Use only when you need to fill a gap in the timeline and you truly don't know what happened.
      - It is a *visual* category so the user sees that time is unknown.
      - But in metrics you must still assign that time as productive/neutral/waste/sleep based on the most likely use.

    Update rules:

    1) EDIT, DON'T RESET
    - If an existing structured day is provided, treat the new recap as CORRECTIONS and ADDITIONS.
    - Merge the new information into the existing state instead of discarding it.
    - Preserve events and details that are not contradicted or changed by the new recap.
    - If the user clarifies that something happened at a different time, update that event's times.
    - If the user adds new activities, insert new events in the correct place in the day.

    2) SLEEP & HOW TO COUNT IT
    - The user will often say things like:
      - "I woke up at 8 and got about 6 hours of sleep."
      - "I woke up at 6am and got 8 hours of sleep."
    - For the NIGHT'S MAIN SLEEP associated with this morning:
      - Assume that entire night of sleep belongs to THIS calendar day (the morning they woke up).
      - Compute a plausible sleep window:
        - endTime = wake time (e.g., 08:00)
        - startTime = wake time minus the number of hours they say they slept
          (clamp at "00:00" if it would go before midnight).
      - Create a single SLEEP event with startTime < endTime, never with startTime > endTime.
      - Set metrics.sleepHours to match the duration of this main sleep block in hours (approximate is fine).
    - Naps:
      - If they nap during the day, create additional sleep events for those naps.
      - By default, naps do NOT change metrics.sleepHours (they are reflected in the timeline only)
        unless the user explicitly emphasizes that these naps should count as extra sleep.
    - Do NOT try to split main sleep across previous or next dates. All of last night's sleep is counted
      on the date of the morning wakeup.

    3) LATE-NIGHT / AFTER-MIDNIGHT EVENTS
    - If the user describes doing something that obviously continues late into the night, like:
      - "I was coding until 2am"
      - "I was playing games until 1:30am"
      treat those activities as happening between 00:00 and the mentioned time on THIS calendar day.
    - For example:
      - "coding until 2am" → an event such as 00:30–02:00 (approximate is okay).
    - ALWAYS keep startTime < endTime within the 00:00–23:59 range for this date.
    - DO NOT create cross-midnight ranges where startTime > endTime, and DO NOT create events on the next date.
    - The server and UI will treat any event whose startTime is between 00:00 and 04:00 as an "After midnight" block.

    4) OVERLAPPING / STACKED EVENTS
    - If the user describes doing two things at once (e.g. studying while checking their phone every 10 minutes),
      create overlapping or stacked events to reflect both activities.
    - For example, you might have a "study" block from 13:00–15:00 and several small "phone scrolling" blocks inside that range.
    - When classifying time, be honest:
      - If they said they were "studying but mostly scrolling", most of that block should be "waste" with only a smaller
        truly focused window marked "productive".

    5) UNTRACKED GAPS
    - Look for significant gaps between events (for example, longer than 30–60 minutes) where the user did not explain what happened.
    - Fill these gaps with events whose category is "untracked".
    - For "untracked" events:
      - Use startTime and endTime to cover the gap.
      - Add a short, cautious note guessing what might have happened based on the rest of the day
        (e.g. "likely commute / misc downtime"), but keep the category "untracked".

    6) METRICS VS UNTRACKED (STRICT)
    - Even though "untracked" events exist, the METRICS must still assign time into one of:
      productive, neutral, waste, sleep.
    - Follow the strict rules:
      - If a block is entertainment / content / scrolling / games → count as waste in metrics.
      - If a block is clearly goal-directed work / study / training → count as productive.
      - If a block is life maintenance (commute, cooking, cleaning, errands, hygiene) → count as neutral.
      - If you are unsure between neutral and waste, default to waste.
    - The metrics should reflect a harsh founder-style view of the day:
      how much time truly went into signal vs noise.

    7) CURRENT LOCAL TIME & RELATIVE PHRASES
    - You will be given the user's current local time when they sent this recap, as "nowLocalTime" in HH:MM (24h) format.
    - If the user uses relative phrases like "just now", "for the last 20 minutes", "the past hour", or "right before this",
      interpret them relative to nowLocalTime.
      - Example: if nowLocalTime = "14:00" and the user says "I just went on my phone for 20 minutes",
        create an event from 13:40 to 14:00.
    - If a relative phrase would push the start time before 00:00 of that date, clamp the start time at "00:00".
    - If no clear duration is given for a "just now" phrase, assume a short reasonable block (e.g., 10–20 minutes)
      based on the rest of the day.

    8) GENERAL RULES
    - Infer rough times from context if possible; otherwise approximate.
    - Be consistent: total hours across categories in metrics should roughly add to 24.
    - Prefer simpler, realistic timelines over overly fragmented ones.
    - Focus on realistic, actionable suggestions (no fluff), especially on converting "waste" into "productive" or at least "neutral".
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

    const analysis = JSON.parse(raw) as DayAnalysis;

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

    // 6) Upsert metrics for THIS day (trust the model, including sleepHours)
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

    // 8) Replace events for THIS day with the UPDATED set from analysis
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
