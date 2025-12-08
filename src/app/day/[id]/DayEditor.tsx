// app/day/[id]/DayEditor.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DayEditorProps = {
  date: string; // YYYY-MM-DD for this day
};

type AnalyzeDayResponse = {
  dayId: string;
  date: string;
  summary: string;
  events: any[];
  metrics?: {
    productiveHours: number;
    neutralHours: number;
    wastedHours: number;
    sleepHours: number;
    focusBlocks: number;
    contextSwitches: number;
  } | null;
  suggestions: string[];
};

export default function DayEditor({ date }: DayEditorProps) {
  const router = useRouter();

  const [transcript, setTranscript] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any | null>(null);

  const startOrStopMic = () => {
    if (typeof window === "undefined") return;

    // If already listening, stop
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice input not supported in this browser. You can type instead.");
      setShowTextBox(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      // Aggregate all transcripts so far
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setTranscript(text.trim());
      setShowTextBox(true); // open the box so user can see/edit
    };

    recognition.onerror = (event: any) => {
      setError(`Voice input error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError("Please record or type something about this day first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, transcript }),
      });

      const body = (await res.json().catch(() => ({}))) as Partial<
        AnalyzeDayResponse & { error?: string }
      >;

      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      // We don't need the response details here – just refresh to show updated day
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to update day.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mb-8 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      {/* Top row: mic + type toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startOrStopMic}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-slate-950 disabled:opacity-60"
          >
            <span className="text-lg">🎙️</span>
            <span>
              {isListening ? "Tap to stop recording" : "Record day update"}
            </span>
          </button>
          {isListening && (
            <span className="text-[11px] text-emerald-300">
              Talking… (you can pause briefly)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTextBox((prev) => !prev)}
          className="text-xs text-sky-300 hover:text-sky-200"
        >
          {showTextBox ? "Hide text" : "Type instead"}
        </button>
      </div>

      {/* Tiny caption */}
      <p className="mt-2 text-[11px] text-slate-400">
        Cadence will merge this into the existing timeline for {date} instead of
        starting from scratch. It can split or overlap events (e.g. studying +
        phone checks every 10 minutes).
      </p>

      {/* Text area dropdown */}
      {showTextBox && (
        <div className="mt-4 space-y-2">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Example: I actually started at 1pm, and I was studying but kept checking my phone every 10 minutes..."
          />
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isSubmitting}
          className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-medium text-slate-950 disabled:opacity-60"
        >
          {isSubmitting ? "Re-analyzing day…" : "Analyze & update this day"}
        </button>
      </div>
    </section>
  );
}
