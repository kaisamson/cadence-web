"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDayButton({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this day, its timeline and its metrics?")) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/days/${dayId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not delete this day");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:border-noise/40 hover:text-noise disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="mt-1 text-[10px] text-noise">{error}</p>}
    </div>
  );
}
