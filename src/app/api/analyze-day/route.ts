import { NextRequest, NextResponse } from "next/server";
import { verifyClientApiKey } from "@/lib/apiAuth";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const OWNER_ID = process.env.OWNER_ID!;

type DayEvent = {
  label: string;
  category: "productive" | "neutral" | "waste" | "sleep";
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
};

export async function POST(req: NextRequest) {
  
  if (!verifyClientApiKey(req)) {
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
    const { date, transcript } = body;

    if (!date || !transcript) {
      return NextResponse.json(
        { error: "Missing date or transcript" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are Cadence, a life optimization assistant.

Given:
- a date (YYYY-MM-DD)
- a free-form daily recap transcript

You must output a JSON object that matches this schema:

{
  "date": "YYYY-MM-DD",
  "events": [
    {
      "label": "string",
      "category": "productive" | "neutral" | "waste" | "sleep",
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

Rules:
- Infer rough times from context if possible; otherwise approximate.
- Be consistent: total hours across categories should roughly add to 24.
- Focus on realistic, actionable suggestions (no fluff).
- Respond with ONLY valid JSON, no commentary.
    `.trim();

    // 1) Call LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Date: ${date}\n\nTranscript:\n${transcript}`,
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

    // 2) Ensure owner exists in public.users (mirror of auth user)
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

    // 3) Upsert day (unique per user + date)
    const { data: dayRow, error: dayError } = await supabaseAdmin
      .from("days")
      .upsert(
        {
          user_id: OWNER_ID,
          date: analysis.date,
          transcript,
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

    // 4) Upsert metrics for this day
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

    // 5) Attach metrics_id to day if missing / changed
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

    // 6) Replace events for this day
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

    // 7) Return the analysis back to the client
    return NextResponse.json(analysis);
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
