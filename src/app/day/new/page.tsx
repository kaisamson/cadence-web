// app/day/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type AnalyzeDayResponse = {
  dayId: string;
  date: string;
  summary: string;
  events: any[];
  metrics: {
    productiveHours: number;
    neutralHours: number;
    wastedHours: number;
    sleepHours: number;
    focusBlocks: number;
    contextSwitches: number;
  };
  suggestions: string[];
};

function todayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewDayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [date, setDate] = useState<string>(todayString());
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If ?date=YYYY-MM-DD is passed (e.g. from dashboard), prefill the date
  useEffect(() => {
    const qpDate = searchParams.get("date");
    if (qpDate) {
      setDate(qpDate);
    }
  }, [searchParams]);

  const handleAnalyze = async () => {
    setLoading(true);
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

      if (!body.dayId) {
        throw new Error("Missing dayId in response");
      }

      // ✅ Go straight into the day detail page
      router.push(`/day/${body.dayId}`);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Cadence – New / Edit Day</h1>
            <p className="mt-1 text-sm text-slate-400">
              Paste your daily recap. Cadence will create or update the analysis
              for this date and regenerate the timeline.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 hover:border-emerald-500 hover:text-emerald-300"
          >
            ← Back to dashboard
          </Link>
        </header>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500">
              If a day already exists for this date, its analysis and timeline
              will be overwritten with this new recap.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Transcript
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="Example: Woke up at 9, scrolled Instagram, studied CS from 11–2, gym at 3, etc..."
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !transcript.trim()}
            className="flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze & save day"}
          </button>
        </section>
      </div>
    </main>
  );
}
