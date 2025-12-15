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

        // Keep sums to 100 reliably
        const signalPct = Math.round(signalShare * 100);
        const noisePct = Math.max(0, 100 - signalPct);

        return (
          <span className="mt-1 text-lg font-semibold">
            <span className="text-emerald-300">{signalPct}</span>
            <span className="text-white/45"> : </span>
            <span className="text-rose-300">{noisePct}</span>
          </span>
        );
      }
    }

    // Default rendering for all other metrics
    return (
      <span className="mt-1 text-lg font-semibold text-white">
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
        "bg-white/[0.04] hover:bg-white/[0.06]",
        isPinned
          ? "border-white/30 shadow-md shadow-white/10"
          : "border-white/10 hover:border-white/25",
      ].join(" ")}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-white/55">
            {metric.label}
          </span>
          {renderValue(metric)}
        </div>

        <span className="text-[10px] rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-white/60">
          {isPinned ? "Pinned" : "Pin"}
        </span>
      </div>

      {metric.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-white/55">
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
            <span className="text-[11px] uppercase tracking-wide text-white/55">
              Key metrics
            </span>
            <span className="text-[10px] text-white/45">
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
          <div className="mb-1 text-[11px] uppercase tracking-wide text-white/55">
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
