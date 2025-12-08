"use client";

import { useState } from "react";

export default function HomePage() {
  const [date, setDate] = useState("2025-12-06");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, transcript }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Cadence – LLM Smoke Test</h1>
        <p className="text-sm text-slate-400">
          Type a recap, hit analyze, and verify we get structured JSON back.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Transcript</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Example: Woke up late, scrolled Instagram for 2 hours, studied CS for 3 hours, went to the gym..."
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !transcript}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Analyze Day"}
        </button>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {result && (
          <pre className="mt-4 max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
