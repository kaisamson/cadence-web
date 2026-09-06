"use client";

import { useRouter } from "next/navigation";
import { addDays, relativeDayLabel } from "@/lib/time";

/** Date navigation for logging a day other than today. */
export function DatePicker({ value, today }: { value: string; today: string }) {
  const router = useRouter();

  function go(date: string) {
    router.push(date === today ? "/today" : `/day/new?date=${date}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(addDays(value, -1))}
        aria-label="Previous day"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted hover:border-line-strong hover:text-ink"
      >
        ←
      </button>

      <label className="relative flex-1">
        <span className="sr-only">Date to log</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-line-strong"
        />
      </label>

      <button
        type="button"
        onClick={() => go(addDays(value, 1))}
        disabled={value >= today}
        aria-label="Next day"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted hover:border-line-strong hover:text-ink disabled:opacity-30"
      >
        →
      </button>

      <button
        type="button"
        onClick={() => go(today)}
        className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-muted hover:border-line-strong hover:text-ink"
      >
        {relativeDayLabel(value, today) === "Today" ? "Today" : "Jump to today"}
      </button>
    </div>
  );
}
