-- dashboard_prefs.pinned_metrics is a leftover name from the removed
-- metric-pinning feature; the column now holds general preferences
-- (currently the user's pursuits, one JSON string per element).
--
-- Applied 2026-09-06. src/lib/prefs.ts now reads and writes `prefs` directly;
-- the runtime column-resolution fallback it used during the transition has been
-- removed.

alter table dashboard_prefs rename column pinned_metrics to prefs;
