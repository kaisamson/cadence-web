// app/api/transcribe/route.ts
//
// Audio -> text. Replaces the browser SpeechRecognition API, which is absent in
// Firefox and unreliable in iOS Safari (continuous mode drops the session after
// a short pause) — the exact combination this app is used on most.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyRequestAuthorized } from "@/lib/apiAuth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MODEL = process.env.CADENCE_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const MAX_BYTES = 25 * 1024 * 1024; // OpenAI's per-file limit

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "Recording was empty" }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: "Recording is too long" }, { status: 413 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: MODEL,
      // Steers spelling toward the vocabulary these recaps actually use.
      prompt:
        "A spoken daily recap describing times, activities, sleep, workouts, study and work blocks.",
    });

    const text = transcription.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't hear anything in that recording" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("transcribe error", err);
    return NextResponse.json(
      { error: "Transcription failed", details: message },
      { status: 500 }
    );
  }
}
