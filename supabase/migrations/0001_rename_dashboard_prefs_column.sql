-- dashboard_prefs.pinned_metrics is a leftover name from the removed
-- metric-pinning feature; the column now holds general preferences
-- (currently the user's pursuits, one JSON string per element).
--
-- Safe to run against a live deployment: src/lib/prefs.ts resolves the column
-- at runtime and works with either name.

alter table dashboard_prefs rename column pinned_metrics to prefs;
