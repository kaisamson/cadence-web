// lib/metricsSync.ts
import { supabaseAdmin } from "./supabaseAdmin";
import { computeMetrics } from "./metrics";
import { hhmm } from "./time";

/**
 * Recompute and persist a day's metrics from its current events.
 * Called after any direct edit so the `metrics` table stays consistent with the
 * timeline. Views derive their own numbers, so a failure here is not fatal.
 */
export async function syncDayMetrics(dayId: string): Promise<void> {
  const { data: eventRows, error } = await supabaseAdmin
    .from("events")
    .select("label, category, start_time, end_time")
    .eq("day_id", dayId);

  if (error) {
    console.error("syncDayMetrics events error", error);
    return;
  }

  const metrics = computeMetrics(
    (eventRows ?? []).map((e) => ({
      label: e.label as string,
      category: e.category as string,
      startTime: hhmm(e.start_time as string | null),
      endTime: hhmm(e.end_time as string | null),
    }))
  );

  const { data: metricsRow, error: upsertError } = await supabaseAdmin
    .from("metrics")
    .upsert(
      {
        day_id: dayId,
        productive_hours: metrics.productiveHours,
        neutral_hours: metrics.neutralHours,
        wasted_hours: metrics.wastedHours,
        sleep_hours: metrics.sleepHours,
        focus_blocks: metrics.focusBlocks,
        context_switches: metrics.contextSwitches,
      },
      { onConflict: "day_id" }
    )
    .select("id")
    .single();

  if (upsertError || !metricsRow) {
    console.error("syncDayMetrics upsert error", upsertError);
    return;
  }

  await supabaseAdmin
    .from("days")
    .update({ metrics_id: metricsRow.id })
    .eq("id", dayId)
    .is("metrics_id", null);
}
