"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Goal = {
  id: string;
  text: string;
  is_done: boolean;
  created_at: string;
  sort_order?: number | null;
};

const UI = {
  card: "rounded-xl border border-white/10 bg-white/[0.04]",
  muted: "text-white/60",
  pillBtn:
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/90 hover:border-white/25 hover:text-white",
  iconBtn:
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/85 hover:border-white/25 hover:text-white",
  handleBtn:
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-white/70 hover:border-white/25 hover:text-white cursor-grab active:cursor-grabbing",
};

function HamburgerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 11.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CurrentGoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [text, setText] = useState("");

  const draggingIdRef = useRef<string | null>(null);

  const remaining = useMemo(() => goals.filter((g) => !g.is_done).length, [goals]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/goals", { cache: "no-store" });
      const json = await res.json();
      setGoals(Array.isArray(json?.goals) ? json.goals : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addGoal() {
    const t = text.trim();
    if (!t) return;

    setText("");

    // optimistic shell (temporarily stick to top visually)
    const optimistic: Goal = {
      id: "optimistic-" + Math.random().toString(16).slice(2),
      text: t,
      is_done: false,
      created_at: new Date().toISOString(),
      sort_order: (goals[goals.length - 1]?.sort_order ?? goals.length - 1) + 1,
    };
    setGoals((prev) => [...prev, optimistic]);

    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });

    if (!res.ok) {
      setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
      return;
    }

    const json = await res.json();
    if (json?.goal) {
      setGoals((prev) => {
        const without = prev.filter((g) => g.id !== optimistic.id);
        return [...without, json.goal as Goal];
      });
    }

    setShowAdd(false);
  }

  async function toggleGoal(goal: Goal) {
    const nextDone = !goal.is_done;

    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, is_done: nextDone } : g)));

    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: nextDone }),
    });

    if (!res.ok) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, is_done: goal.is_done } : g)));
    }
  }

  async function deleteGoal(goal: Goal) {
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));

    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (!res.ok) setGoals((prev) => [...prev, goal]);
  }

  function reorderArray(list: Goal[], fromId: string, toId: string) {
    if (fromId === toId) return list;
    const fromIdx = list.findIndex((g) => g.id === fromId);
    const toIdx = list.findIndex((g) => g.id === toId);
    if (fromIdx < 0 || toIdx < 0) return list;

    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    return next;
  }

  async function persistOrder(next: Goal[]) {
    // write 0..N-1 to sort_order
    setGoals(next);

    await Promise.all(
      next.map((g, idx) =>
        fetch(`/api/goals/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: idx }),
        })
      )
    );
  }

  return (
    <div className={`${UI.card} p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Current goals
          </h2>
          <p className={`mt-1 text-xs ${UI.muted}`}>
            {loading ? "Loading…" : `${remaining} remaining`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={UI.iconBtn}
          title={showAdd ? "Close" : "Add goal"}
          aria-label={showAdd ? "Close add goal" : "Open add goal"}
        >
          <span className="text-base leading-none">{showAdd ? "×" : "+"}</span>
        </button>
      </div>

      {/* Add (collapsible) */}
      {showAdd && (
        <div className="mt-3 space-y-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addGoal();
              if (e.key === "Escape") setShowAdd(false);
            }}
            autoFocus
            placeholder="Add a goal…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/25"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/80 hover:border-white/25 hover:text-white"
            >
              Cancel
            </button>
            <button type="button" onClick={addGoal} className={UI.pillBtn}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Scroll list */}
      <div className="mt-3 h-56 overflow-y-auto pr-1">
        <div className="space-y-2">
          {!loading && goals.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 text-xs text-white/60">
              No goals yet.
            </div>
          )}

          {goals.map((g) => (
            <div
              key={g.id}
              // drop target on the row
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/plain") || draggingIdRef.current;
                if (!fromId) return;

                const next = reorderArray(goals, fromId, g.id);
                draggingIdRef.current = null;
                await persistOrder(next);
              }}
              className={[
                "group flex items-center gap-2 rounded-lg border px-3 transition-colors",
                "h-10", // fixed height
                g.is_done
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25",
              ].join(" ")}
            >
              {/* Toggle + text (truncated so row never grows) */}
              <button
                type="button"
                onClick={() => toggleGoal(g)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="Toggle complete"
              >
                <span
                  className={[
                    "grid h-4 w-4 place-items-center rounded border text-[10px] font-bold",
                    g.is_done
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                      : "border-white/20 bg-white/[0.02] text-white/30",
                  ].join(" ")}
                >
                  {g.is_done ? "✓" : ""}
                </span>

                <span
                  className={[
                    "min-w-0 flex-1 truncate text-xs",
                    g.is_done ? "text-emerald-100 line-through" : "text-white/90",
                  ].join(" ")}
                >
                  {g.text}
                </span>
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => deleteGoal(g)}
                className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] text-white/70 opacity-0 transition-opacity hover:border-white/25 hover:text-white group-hover:opacity-100"
                title="Delete"
              >
                Delete
              </button>

              {/* Drag handle (hamburger) */}
              <button
                type="button"
                className={UI.handleBtn}
                title="Drag to reorder"
                draggable
                onDragStart={(e) => {
                  draggingIdRef.current = g.id;
                  e.dataTransfer.setData("text/plain", g.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  draggingIdRef.current = null;
                }}
              >
                <HamburgerIcon />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
