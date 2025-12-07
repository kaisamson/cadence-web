import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type AnalyzeDayBody = {
  date?: string;
  transcript?: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
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

    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("analyze-day error", err);
    return NextResponse.json(
      { error: "Internal error", details: String(err) },
      { status: 500 }
    );
  }
}
