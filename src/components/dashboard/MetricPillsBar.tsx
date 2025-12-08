// components/dashboard/MetricPillsBar.tsx
"use client";

import { useEffect, useState } from "react";

type MetricConfig = {
  key: string;
  label: string;
  valueLabel: string;
  description?: string;
};

type MetricPillsBarProps = {
  metrics: MetricConfig[];
  defaultPinnedKeys: string[];
};

export function MetricPillsBar({
  metrics,
  defaultPinnedKeys,
}: MetricPillsBarProps) {
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(defaultPinnedKeys);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync if defaults change (SSR → client)
  useEffect(() => {
    setPinnedKeys(defaultPinnedKeys);
  }, [defaultPinnedKeys.join(",")]);

  const persistPinned = async (nextPinned: string[]) => {
    try {
      setSaving(true);
      await fetch("/api/dashboard-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_metrics: nextPinned }),
      });
    } catch (err) {
      console.error("Failed to save pinned metrics", err);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = (key: string) => {
    setPinnedKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];

      void persistPinned(next);
      return next;
    });
  };

  const pinned = metrics.filter((m) => pinnedKeys.includes(m.key));
  const unpinned = metrics.filter((m) => !pinnedKeys.includes(m.key));

  const renderValue = (metric: MetricConfig) => {
    // Special rendering for Signal / Noise (sn14)
    if (metric.key === "sn14" && metric.valueLabel !== "–") {
      // valueLabel is like "1.50x" → extract numeric ratio
      const ratio = parseFloat(metric.valueLabel.replace("x", "").trim());
      if (!isNaN(ratio) && ratio >= 0) {
        // Signal = productive, Noise = waste
        const signalShare = ratio / (ratio + 1); // prod / (prod + waste)
        const noiseShare = 1 / (ratio + 1);

        const signalPct = Math.round(signalShare * 100);
        const noisePct = Math.round(noiseShare * 100);

        return (
          <span className="mt-1 text-lg font-semibold">
            <span className="text-emerald-300">{signalPct}</span>
            <span className="text-slate-500"> : </span>
            <span className="text-rose-400">{noisePct}</span>
          </span>
        );
      }
    }

    // Default rendering for all other metrics
    return (
      <span className="mt-1 text-lg font-semibold text-slate-100">
        {metric.valueLabel}
      </span>
    );
  };

  const renderMetricCard = (metric: MetricConfig, isPinned: boolean) => (
    <button
      key={metric.key}
      type="button"
      onClick={() => togglePin(metric.key)}
      className={[
        "flex flex-col items-start rounded-lg border p-3 text-left transition",
        "bg-slate-900/70 hover:bg-slate-900",
        isPinned
          ? "border-emerald-500/60 shadow-md shadow-emerald-500/10"
          : "border-slate-700",
      ].join(" ")}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            {metric.label}
          </span>
          {renderValue(metric)}
        </div>
        <span className="text-[10px] rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">
          {isPinned ? "Pinned" : "Pin"}
        </span>
      </div>
      {metric.description && (
        <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
          {metric.description}
        </p>
      )}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Pinned metrics */}
      {pinned.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              Key metrics
            </span>
            <span className="text-[10px] text-slate-500">
              Tap a card to pin / unpin
              {saving && " · saving..."}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {pinned.map((m) => renderMetricCard(m, true))}
          </div>
        </div>
      )}

      {/* Other metrics */}
      {unpinned.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
            More metrics
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {unpinned.map((m) => renderMetricCard(m, false))}
          </div>
        </div>
      )}
    </div>
  );
}
