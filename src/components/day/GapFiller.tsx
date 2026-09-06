"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Gap } from "@/lib/insights";
import { formatClock, formatDuration, minutesToTime, nowLocalTime } from "@/lib/time";

/**
 * Unaccounted time averages ~4.8h/day across the log — more than logged noise.
 * Rather than showing that as a number to feel bad about, this asks the one
 * question that shrinks it, for the single biggest gap, and appends the answer
 * to the day.
 */
export function GapFiller({ date, gaps }: { date: string; gaps: Gap[] }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const gap = gaps.find((g) => !dismissed.includes(g.start));
  if (!gap) return null;

  async function submit() {
    if (!gap || !answer.trim()) return;
    setBusy(true);
    setError(null);

    const window = `${formatClock(minutesToTime(gap.start))} to ${formatClock(
      minutesToTime(gap.end)
    )}`;

    try {
      const res = await fetch("/api/analyze-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          nowLocalTime: nowLocalTime(),
          // Phrased so the model places it in the right window rather than
          // guessing where this belongs in the day.
          transcript: `Between ${window} I was: ${answer.trim()}`,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save");
      setAnswer("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-unknown/30 bg-unknown/[0.06] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Fill a gap</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatDuration(gap.minutes)} unaccounted between{" "}
            <span className="tabular-nums text-ink">
              {formatClock(minutesToTime(gap.start))}
            </span>{" "}
            and{" "}
            <span className="tabular-nums text-ink">
              {formatClock(minutesToTime(gap.end))}
            </span>
            . What were you doing?
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed((d) => [...d, gap.start])}
          aria-label="Skip this gap"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-faint hover:text-ink"
        >
          Skip
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
          placeholder="Commuting, then lunch…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-line-strong disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !answer.trim()}
          className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-canvas disabled:opacity-30"
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-noise">
          {error}
        </p>
      )}
    </div>
  );
}
