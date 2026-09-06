"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PursuitStat } from "@/lib/pursuits";
import { relativeDayLabel } from "@/lib/time";

/**
 * Things you're trying to do more of, matched against event labels by keyword.
 *
 * Keywords are editable because the model's wording varies — "Gym workout",
 * "Driving range", "Golf at the range" are all one pursuit, and no fixed rule
 * would have caught them.
 */
export function PursuitsCard({
  stats,
  today,
  windowLabel,
}: {
  stats: PursuitStat[];
  today: string;
  windowLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    stats.map((s) => ({ ...s.pursuit, keywords: s.pursuit.keywords.join(", ") }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxHours = Math.max(1, ...stats.map((s) => s.hours));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pursuits: draft
            .filter((p) => p.name.trim())
            .map((p) => ({
              id: p.id,
              name: p.name.trim(),
              keywords: p.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            })),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Pursuits</h2>
          <p className="mt-0.5 text-xs text-ink-muted">{windowLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:border-line-strong hover:text-ink"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          {draft.map((p, i) => (
            <div key={p.id} className="rounded-lg border border-line bg-surface-2 p-2.5">
              <input
                value={p.name}
                onChange={(e) =>
                  setDraft((d) => d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
                placeholder="Name"
                className="w-full rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-line-strong"
              />
              <input
                value={p.keywords}
                onChange={(e) =>
                  setDraft((d) => d.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))
                }
                placeholder="keywords, comma, separated"
                className="mt-1.5 w-full rounded-md border border-line bg-surface-3 px-2.5 py-1.5 text-[11px] text-ink-muted outline-none focus:border-line-strong"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setDraft((d) => [
                ...d,
                { id: `p${Date.now()}`, name: "", keywords: "" },
              ])
            }
            className="w-full rounded-lg border border-dashed border-line-strong py-2 text-[11px] text-ink-muted hover:text-ink"
          >
            + Add pursuit
          </button>

          {error && <p className="text-[11px] text-noise">{error}</p>}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-ink py-2.5 text-xs font-semibold text-canvas disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save pursuits"}
          </button>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {stats.length === 0 && (
            <li className="text-xs text-ink-faint">No pursuits configured.</li>
          )}
          {stats.map((s) => (
            <li key={s.pursuit.id}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-ink">{s.pursuit.name}</span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  {s.sessionDays} {s.sessionDays === 1 ? "day" : "days"}
                  <span className="ml-1.5 text-ink-faint">{s.hours.toFixed(1)}h</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-signal"
                  style={{ width: `${(s.hours / maxHours) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-ink-faint">
                {s.lastSeen ? `Last: ${relativeDayLabel(s.lastSeen, today)}` : "Not yet logged"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
