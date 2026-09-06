"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Goal = {
  id: string;
  text: string;
  is_done: boolean;
  created_at: string;
  sort_order?: number | null;
};

/** Reorder controls are buttons, not drag handles: HTML5 drag-and-drop does not
 *  work on touch at all, and this list is used mostly on a phone. */
function move(list: Goal[], index: number, delta: number): Goal[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function GoalsCard({ compact = false }: { compact?: boolean }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = useMemo(() => goals.filter((g) => !g.is_done).length, [goals]);
  const visible = compact ? goals.filter((g) => !g.is_done).slice(0, 5) : goals;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/goals", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setGoals(Array.isArray(json?.goals) ? json.goals : []);
      } catch {
        if (!cancelled) setError("Couldn't load goals");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addGoal() {
    const value = text.trim();
    if (!value) return;
    setText("");
    setError(null);

    const optimistic: Goal = {
      id: `pending-${Math.random().toString(16).slice(2)}`,
      text: value,
      is_done: false,
      created_at: new Date().toISOString(),
    };
    setGoals((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setGoals((prev) => prev.map((g) => (g.id === optimistic.id ? json.goal : g)));
    } catch {
      setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
      setError("Couldn't add that goal");
    }
  }

  async function toggle(goal: Goal) {
    const next = !goal.is_done;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, is_done: next } : g)));

    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: next }),
    });

    if (!res.ok) {
      setGoals((prev) =>
        prev.map((g) => (g.id === goal.id ? { ...g, is_done: goal.is_done } : g))
      );
    }
  }

  async function remove(goal: Goal) {
    // Remember the position so a failed delete restores it in place rather than
    // appending the goal to the bottom of the list.
    const index = goals.findIndex((g) => g.id === goal.id);
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));

    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (!res.ok) {
      setGoals((prev) => {
        const restored = [...prev];
        restored.splice(index, 0, goal);
        return restored;
      });
      setError("Couldn't delete that goal");
    }
  }

  async function reorder(index: number, delta: number) {
    const next = move(goals, index, delta);
    if (next === goals) return;
    setGoals(next);

    const res = await fetch("/api/goals/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((g) => g.id) }),
    });
    if (!res.ok) setError("Couldn't save the new order");
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Current goals</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {loading ? "Loading…" : `${remaining} remaining`}
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
            placeholder="Add a goal…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
          <button
            type="button"
            onClick={addGoal}
            disabled={!text.trim()}
            className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-canvas disabled:opacity-30"
          >
            Add
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-noise">
          {error}
        </p>
      )}

      <ul className={`mt-3 space-y-1.5 ${compact ? "" : "min-h-20"}`}>
        {!loading && visible.length === 0 && (
          <li className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-ink-faint">
            {compact ? "Nothing outstanding." : "No goals yet."}
          </li>
        )}

        {visible.map((goal, index) => (
          <li
            key={goal.id}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
              goal.is_done ? "border-signal/30 bg-signal/5" : "border-line bg-surface-2"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(goal)}
              aria-pressed={goal.is_done}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-bold ${
                  goal.is_done
                    ? "border-signal/60 bg-signal/20 text-signal"
                    : "border-line-strong text-transparent"
                }`}
              >
                ✓
              </span>
              <span
                className={`min-w-0 flex-1 text-[13px] ${
                  goal.is_done ? "text-ink-faint line-through" : "text-ink"
                }`}
              >
                {goal.text}
              </span>
            </button>

            {!compact && (
              <div className="flex shrink-0 items-center gap-0.5">
                <IconButton
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => reorder(index, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === goals.length - 1}
                  onClick={() => reorder(index, 1)}
                >
                  ↓
                </IconButton>
                <IconButton label="Delete goal" onClick={() => remove(goal)} danger>
                  ×
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md border border-line text-sm transition-colors disabled:opacity-25 ${
        danger
          ? "text-ink-faint hover:border-noise/40 hover:text-noise"
          : "text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
