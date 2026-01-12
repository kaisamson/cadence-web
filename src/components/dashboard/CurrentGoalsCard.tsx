"use client";

import { useEffect, useMemo, useState } from "react";

type Goal = {
  id: string;
  text: string;
  is_done: boolean;
  created_at: string;
};

const UI = {
  card: "rounded-xl border border-white/10 bg-white/[0.04]",
  muted: "text-white/60",
  subtle: "text-white/45",
  pillBtn:
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/90 hover:border-white/25 hover:text-white",
};

export function CurrentGoalsCard() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
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

    // optimistic insert shell
    setText("");
    const optimistic: Goal = {
      id: "optimistic-" + Math.random().toString(16).slice(2),
      text: t,
      is_done: false,
      created_at: new Date().toISOString(),
    };
    setGoals((prev) => [optimistic, ...prev]);

    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t }),
    });

    if (!res.ok) {
      // rollback
      setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
      return;
    }

    const json = await res.json();
    if (json?.goal) {
      setGoals((prev) => [json.goal as Goal, ...prev.filter((g) => g.id !== optimistic.id)]);
    }
  }

  async function toggleGoal(goal: Goal) {
    const nextDone = !goal.is_done;

    // optimistic
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, is_done: nextDone } : g)));

    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: nextDone }),
    });

    if (!res.ok) {
      // rollback
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, is_done: goal.is_done } : g)));
    }
  }

  async function deleteGoal(goal: Goal) {
    // optimistic
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));

    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (!res.ok) {
      // rollback
      setGoals((prev) => [goal, ...prev]);
    }
  }

  return (
    <div className={`${UI.card} p-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Current goals
          </h2>
          <p className={`mt-1 text-xs ${UI.muted}`}>
            {loading ? "Loading…" : `${remaining} remaining`}
          </p>
        </div>
      </div>

      {/* Add row */}
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addGoal();
          }}
          placeholder="Add a goal…"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-white/25"
        />
        <button onClick={addGoal} className={UI.pillBtn}>
          Add
        </button>
      </div>

      {/* List */}
      <div className="mt-3 space-y-2">
        {!loading && goals.length === 0 && (
          <div className={`rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 text-xs ${UI.muted}`}>
            No goals yet.
          </div>
        )}

        {goals.map((g) => (
          <div
            key={g.id}
            className={[
              "group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
              g.is_done
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/25",
            ].join(" ")}
          >
            <button
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
                  "truncate text-xs",
                  g.is_done ? "text-emerald-100 line-through" : "text-white/90",
                ].join(" ")}
              >
                {g.text}
              </span>
            </button>

            <button
              onClick={() => deleteGoal(g)}
              className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] text-white/70 opacity-0 transition-opacity hover:border-white/25 hover:text-white group-hover:opacity-100"
              title="Delete"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className={`mt-3 text-[11px] ${UI.subtle}`}>
        Click a goal to mark complete. Completed turns green.
      </div>
    </div>
  );
}
