"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/* ============================================================
   Types
   ============================================================ */
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

/* ============================================================
   Helper
   ============================================================ */
function todayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   NEW DAY PAGE (CLIENT COMPONENT)
   ============================================================ */
export default function NewDayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [date, setDate] = useState<string>(todayString());
  const [transcript, setTranscript] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any | null>(null);

  /* ============================================================
     Prefill date from query params
     ============================================================ */
  useEffect(() => {
    const qpDate = searchParams.get("date");
    if (qpDate) setDate(qpDate);
  }, [searchParams]);

  /* ============================================================
     MICROPHONE RECORDING
     ============================================================ */
  const startOrStopMic = () => {
    if (typeof window === "undefined") return;

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
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setTranscript(text.trim());
      setShowTextBox(true);
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

  /* ============================================================
     ANALYZE DAY
     ============================================================ */
  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setError("Please record or type something first.");
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

      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (!body.dayId) throw new Error("Missing dayId in response");

      router.push(`/day/${body.dayId}`);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ============================================================
     UI (Cadence black/white colorway)
     ============================================================ */
  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Cadence – New Day</h1>
            <p className="mt-1 text-sm text-white/60">
              Record or paste your recap. Cadence will build the full timeline and
              metrics for this date.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/90 hover:border-white/25 hover:text-white"
          >
            ← Back to dashboard
          </Link>
        </header>

        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          {/* Date */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-white/60">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-white/25"
            />
          </div>

          {/* Mic + Type controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={startOrStopMic}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/90 hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
            >
              <span className="text-lg">🎙️</span>
              {isListening ? "Tap to stop recording" : "Record recap"}
            </button>

            <button
              type="button"
              onClick={() => setShowTextBox((prev) => !prev)}
              className="text-xs text-white/70 hover:text-white"
            >
              {showTextBox ? "Hide text" : "Type instead"}
            </button>
          </div>

          <p className="text-[11px] text-white/55">
            Cadence will generate a structured timeline for this day and compute all metrics.
          </p>

          {/* Transcript textbox */}
          {showTextBox && (
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25"
              placeholder="Example: Woke up at 9, scrolled Instagram, worked from 11–2, gym at 3..."
            />
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleAnalyze}
            disabled={isSubmitting || !transcript.trim()}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/90 hover:border-white/25 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            {isSubmitting ? "Analyzing..." : "Analyze & save day"}
          </button>
        </section>
      </div>
    </main>
  );
}
