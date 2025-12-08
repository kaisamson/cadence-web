"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDayButton({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("Delete this day and all its events/metrics?")) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/days/${dayId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any));
        throw new Error(body.error || `Failed to delete day (HTTP ${res.status})`);
      }

      // Go back to dashboard after delete
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to delete day.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-60"
      >
        {isDeleting ? "Deleting…" : "Delete day"}
      </button>
      {error && (
        <p className="text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
