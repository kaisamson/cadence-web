// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";
import { MetricPillsBar } from "@/components/dashboard/MetricPillsBar";

const OWNER_ID = process.env.OWNER_ID!;

type MetricsRow = {
  productive_hours: number | null;
  neutral_hours: number | null;
  wasted_hours: number | null;
  sleep_hours: number | null;
  focus_blocks: number | null;
  context_switches: number | null;
};

type DayRow = {
  id: string;
  date: string; // YYYY-MM-DD
  summary: string | null;
  suggestions: string[] | null;
  created_at: string;
  metrics: MetricsRow | null;
};

type DashboardPrefsRow = {
  pinned_metrics: string[] | null;
};

export const dynamic = "force-dynamic";

/* ======================================================================
   Auth + data
   ====================================================================== */

async function requireAuthForDashboard() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("cadence_auth");
  if (auth?.value !== "1") {
    redirect("/login?from=/dashboard");
  }
}

async function getDays(): Promise<DayRow[]> {
  if (!OWNER_ID) {
    throw new Error("OWNER_ID not set");
  }

  const { data, error } = await supabaseAdmin
    .from("days")
    .select(
      `
      id,
      date,
      summary,
      suggestions,
      created_at,
      metrics:metrics_id (
        productive_hours,
        neutral_hours,
        wasted_hours,
        sleep_hours,
        focus_blocks,
        context_switches
      )
    `
    )
    .eq("user_id", OWNER_ID)
    .order("date", { ascending: false });

  if (error) {
    console.error("getDays error", error);
    throw error;
  }

  const rows = (data ?? []) as any[];

  const normalized: DayRow[] = rows.map((row) => {
    const rawMetrics = row.metrics;
    const metrics = Array.isArray(rawMetrics)
      ? rawMetrics[0] ?? null
      : rawMetrics ?? null;

    return {
      id: row.id,
      date: row.date,
      summary: row.summary,
      suggestions: row.suggestions,
      created_at: row.created_at,
      metrics,
    };
  });

  return normalized;
}

async function getDashboardPrefs(): Promise<string[]> {
  if (!OWNER_ID) return [];

  const { data, error } = await supabaseAdmin
    .from("dashboard_prefs")
    .select("pinned_metrics")
    .eq("user_id", OWNER_ID)
    .maybeSingle<DashboardPrefsRow>();

  if (error) {
    console.error("getDashboardPrefs error", error);
    return [];
  }

  return data?.pinned_metrics ?? [];
}

// Count gym sessions over the last 7 days based on events whose label starts with "Gym"
async function getGymSessionsLast7(days: DayRow[]): Promise<number> {
  if (!OWNER_ID || days.length === 0) return 0;

  const today = new Date();
  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const last7DateStrs: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    last7DateStrs.push(toDateStr(d));
  }

  const dayIds = days
    .filter((d) => last7DateStrs.includes(d.date))
    .map((d) => d.id);

  if (dayIds.length === 0) return 0;

  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, label, day_id")
    .eq("user_id", OWNER_ID)
    .in("day_id", dayIds)
    .ilike("label", "gym%"); // Only labels starting with "Gym..."

  if (error) {
    console.error("getGymSessionsLast7 error", error);
    return 0;
  }

  return (data ?? []).length;
}

/* ======================================================================
   Date utilities
   ====================================================================== */

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((v) => Number(v));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Monday as start-of-week anchor
function getMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day + 6) % 7; // 0 if Mon, 1 if Tue, ..., 6 if Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getTodayDateStr(): string {
  return toDateStr(new Date());
}

// Build week as Sunday–Saturday, using a Monday anchor.
// If anchor is Monday 2025-12-08, this yields Sunday 2025-12-07 → Saturday 2025-12-13.
function getWeekDatesFromMondayAnchor(
  monday: Date
): { dateStr: string; label: string; dayName: string }[] {
  const result: { dateStr: string; label: string; dayName: string }[] = [];

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1); // Sunday before this Monday

  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = toDateStr(d);
    const dayName = d.toLocaleDateString("en-CA", { weekday: "short" });
    const label = d.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
    result.push({ dateStr, label, dayName });
  }

  return result;
}

function getLastNDates(n: number): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(toDateStr(d));
  }
  return dates;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

function formatHours(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(1)}h`;
}

/* ======================================================================
   Tiny SVG line chart
   ====================================================================== */

function buildLinePoints(values: (number | null)[]): string {
  const n = values.length;
  if (n === 0) return "";

  const valid = values.filter((v) => v != null) as number[];
  if (valid.length === 0) {
    return values
      .map((_, i) => {
        const x = n === 1 ? 50 : (i / (n - 1)) * 100;
        const y = 50;
        return `${x},${y}`;
      })
      .join(" ");
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 1;

  return values
    .map((v, i) => {
      const x = n === 1 ? 50 : (i / (n - 1)) * 100;
      const yVal = v == null ? min : v;
      const y = 90 - ((yVal - min) / span) * 80; // padding + invert
      return `${x},${y}`;
    })
    .join(" ");
}

function LineChartCard(props: {
  title: string;
  subtitle?: string;
  unit?: string;
  dates: string[];
  values: (number | null)[];
  averageLabel?: string;
  averageValue?: number | null;
}) {
  const { title, subtitle, unit, dates, values, averageLabel, averageValue } =
    props;
  const points = buildLinePoints(values);
  const hasData = values.some((v) => v != null);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {averageLabel && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              {averageLabel}
            </div>
            <div className="text-lg font-semibold text-emerald-300">
              {averageValue != null
                ? `${averageValue.toFixed(1)}${unit ?? ""}`
                : "-"}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 h-28">
        {hasData ? (
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="90"
              x2="100"
              y2="90"
              className="stroke-slate-700"
              strokeWidth={0.5}
            />
            <polyline
              points={`0,90 ${points} 100,90`}
              className="fill-emerald-500/10 stroke-none"
            />
            <polyline
              points={points}
              className="fill-none stroke-emerald-400"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {values.map((v, i) => {
              if (v == null) return null;
              const allPoints = points.split(" ");
              if (!allPoints[i]) return null;
              const [x, y] = allPoints[i].split(",").map(Number);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={1.6}
                  className="fill-emerald-300"
                />
              );
            })}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Not enough data yet.
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        {dates.map((d, i) => {
          const label = d.slice(5); // MM-DD
          return (
            <span
              key={d}
              className={i === 0 || i === dates.length - 1 ? "" : "hidden md:inline"}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ======================================================================
   Page
   ====================================================================== */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

  await requireAuthForDashboard();

  const sp = await searchParams;

  const days = await getDays();
  const latest = days[0];
  const today = new Date();
  const todayStr = getTodayDateStr();

  const dayByDate = new Map<string, DayRow>();
  days.forEach((d) => dayByDate.set(d.date, d));

  const totalProductive = days.reduce(
    (sum, d) => sum + (d.metrics?.productive_hours ?? 0),
    0
  );
  const totalWasted = days.reduce(
    (sum, d) => sum + (d.metrics?.wasted_hours ?? 0),
    0
  );

  const last14Dates = getLastNDates(14);
  const sleepValues = last14Dates.map((dateStr) => {
    const d = dayByDate.get(dateStr);
    return d?.metrics?.sleep_hours ?? null;
  });

  // Only count days that actually have sleep logged (> 0)
  const sleepValid = sleepValues.filter(
    (v) => v != null && v > 0
  ) as number[];

  const avgSleepLast14 =
    sleepValid.length > 0
      ? sleepValid.reduce((a, b) => a + b, 0) / sleepValid.length
      : null;


  const ratioValues = last14Dates.map((dateStr) => {
    const d = dayByDate.get(dateStr);
    const prod = d?.metrics?.productive_hours ?? null;
    const waste = d?.metrics?.wasted_hours ?? null;
    if (prod == null || waste == null) return null;
    if (waste === 0) return prod === 0 ? 0 : prod;
    return prod / waste;
  });
  const ratioValid = ratioValues.filter((v) => v != null) as number[];
  const avgRatioLast14 =
    ratioValid.length > 0
      ? ratioValid.reduce((a, b) => a + b, 0) / ratioValid.length
      : null;

  const gymSessionsLast7 = await getGymSessionsLast7(days);

  // ===== Week selection (Google Calendar style) =====
  const currentWeekMonday = getMonday(today);

  // Normalize week param (string | string[] | undefined -> string | undefined)
  const weekParamRaw = sp?.week;
  const weekParam =
    Array.isArray(weekParamRaw) && weekParamRaw.length > 0
      ? weekParamRaw[0]
      : typeof weekParamRaw === "string"
      ? weekParamRaw
      : undefined;

  let anchorMonday: Date;
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    anchorMonday = getMonday(parseDateStr(weekParam));
  } else {
    anchorMonday = currentWeekMonday;
  }

  const weekDates = getWeekDatesFromMondayAnchor(anchorMonday);
  const weekRangeLabel = `${formatShortDate(
    weekDates[0].dateStr
  )} – ${formatShortDate(weekDates[6].dateStr)}`;

  const anchorMondayStr = toDateStr(anchorMonday);

  const prevWeekMonday = new Date(anchorMonday);
  prevWeekMonday.setDate(anchorMonday.getDate() - 7);
  const prevWeekStr = toDateStr(prevWeekMonday);

  const nextWeekMonday = new Date(anchorMonday);
  nextWeekMonday.setDate(anchorMonday.getDate() + 7);
  const nextWeekStr = toDateStr(nextWeekMonday);

  //const canGoForward = anchorMonday.getTime() < currentWeekMonday.getTime();
  //^ Disabled, but enable if you want to prevent navigating into future weeks
  const canGoForward = true;

  const pinnedFromDb = await getDashboardPrefs();

  const metricPills = [
    {
      key: "totalProductive",
      label: "Total productive",
      valueLabel: `${totalProductive.toFixed(1)}h`,
      description: "All-time logged productive hours",
    },
    {
      key: "totalWasted",
      label: "Total wasted",
      valueLabel: `${totalWasted.toFixed(1)}h`,
      description: "All-time logged wasted hours",
    },
    {
      key: "avgSleep14",
      label: "Avg sleep (14d)",
      valueLabel:
        avgSleepLast14 != null ? `${avgSleepLast14.toFixed(1)}h` : "–",
      description: "Average nightly sleep over the last 14 days",
    },
    {
      key: "sn14",
      label: "Signal / Noise (14d)",
      // MetricPillsBar should render this as something like "80 : 20" with green/red split
      valueLabel:
        avgRatioLast14 != null ? `${avgRatioLast14.toFixed(2)}x` : "–",
      description: "Average productive-to-waste ratio over the last 14 days",
    },
    {
      key: "gym7",
      label: "Gym sessions (7d)",
      valueLabel: String(gymSessionsLast7),
      description: "Total gym sessions in the last 7 days",
    },
  ];

  const defaultPinned =
    pinnedFromDb.length > 0
      ? pinnedFromDb
      : ["totalProductive", "avgSleep14", "gym7"];

  

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* HEADER */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cadence Dashboard</h1>
            <p className="text-sm text-slate-400">
              Weekly view, recovery, and your signal-to-noise over time.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 text-sm">
            <Link
              href="/day/new"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:border-emerald-500 hover:text-emerald-300"
            >
              + New / Edit day
            </Link>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-emerald-300/80">
                Total productive
              </div>
              <div className="text-lg font-semibold">
                {totalProductive.toFixed(1)}h
              </div>
            </div>
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-wide text-red-300/80">
                Total wasted
              </div>
              <div className="text-lg font-semibold">
                {totalWasted.toFixed(1)}h
              </div>
            </div>
          </div>
        </header>

        {/* WEEK STRIP WITH NAV */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Week at a glance
              </h2>
              <span className="text-[11px] text-slate-500">
                {weekRangeLabel}
              </span>
              {/* Optional tiny debug tag if you ever want it:
              <span className="text-[10px] text-slate-600">
                (anchor Monday: {anchorMondayStr})
              </span>
              */}
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <Link
                href={`/dashboard?week=${prevWeekStr}`}
                prefetch={false}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 hover:border-emerald-400 hover:text-emerald-200"
              >
                <span>←</span>
                <span>Prev</span>
              </Link>

              <Link
                href={`/dashboard?week=${nextWeekStr}`}
                prefetch={false}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 hover:border-emerald-400 hover:text-emerald-200"
              >
                <span>Next</span>
                <span>→</span>
              </Link>

            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2 text-xs">
            {weekDates.map(({ dateStr, label, dayName }) => {
              const entry = dayByDate.get(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={[
                    "flex flex-col rounded-lg border px-2 py-2 transition-colors",
                    isToday
                      ? "border-emerald-500/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                      : entry
                      ? "border-slate-700 bg-slate-900/80 hover:border-emerald-400/60"
                      : "border-slate-800 bg-slate-950/40 text-slate-500",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {dayName}
                    </div>
                    <div className="text-[11px] text-slate-300">{label}</div>
                  </div>

                  {entry ? (
                    <Link
                      href={`/day/${entry.id}`}
                      className="mt-1 line-clamp-3 text-[11px] text-slate-200 hover:text-emerald-200"
                    >
                      {entry.summary ?? "No summary"}
                    </Link>
                  ) : (
                    <div className="mt-1 text-[11px] italic text-slate-500">
                      No entry
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* METRIC CARDS UNDER WEEK */}
        <section>
          <MetricPillsBar
            metrics={metricPills}
            defaultPinnedKeys={defaultPinned}
          />
        </section>

        {/* METRIC CARDS + CHARTS */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* Latest day – smaller card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:col-span-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Latest day
            </h2>
            {latest ? (
              <>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {formatDate(latest.date)}
                </div>
                <p className="mt-1 line-clamp-4 text-xs text-slate-300">
                  {latest.summary ?? "No summary available."}
                </p>
                {latest.suggestions && latest.suggestions.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                    {latest.suggestions.slice(0, 3).map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        <span className="line-clamp-2">{s}</span>
                      </li>
                    ))}
                    {latest.suggestions.length > 3 && (
                      <li className="text-[10px] text-slate-500">
                        + {latest.suggestions.length - 3} more suggestions on
                        the day page
                      </li>
                    )}
                  </ul>
                )}
                <Link
                  href={`/day/${latest.id}`}
                  className="mt-3 inline-flex items-center text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                >
                  View full analysis →
                </Link>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No days analyzed yet. Go to the home page and run your first
                recap.
              </p>
            )}
          </div>

          <LineChartCard
            title="Sleep (last 14 days)"
            subtitle="Average nightly sleep over the last two weeks."
            unit="h"
            dates={last14Dates}
            values={sleepValues}
            averageLabel="Avg sleep (14d)"
            averageValue={avgSleepLast14}
          />

          <LineChartCard
            title="Signal / Noise (last 14 days)"
            subtitle="Productive hours vs wasted time."
            unit="x"
            dates={last14Dates}
            values={ratioValues}
            averageLabel="Avg S/N (14d)"
            averageValue={avgRatioLast14}
          />
        </section>

        {/* GYM + EXTRA METRICS */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* Gym sessions last 7 days */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Gym sessions (last 7 days)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Based on events whose label starts with &quot;Gym&quot;.
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-emerald-300">
                {gymSessionsLast7}
              </span>
              <span className="text-xs text-slate-400">
                {gymSessionsLast7 === 1 ? "session" : "sessions"}
              </span>
            </div>
          </div>

          {/* Focus blocks + context switches compact view */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Focus & context switching
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Totals across all logged days.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">
                  Focus blocks
                </div>
                <div className="mt-1 text-xl font-semibold text-emerald-200">
                  {days.reduce(
                    (sum, d) => sum + (d.metrics?.focus_blocks ?? 0),
                    0
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-300/80">
                  Context switches
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-100">
                  {days.reduce(
                    (sum, d) => sum + (d.metrics?.context_switches ?? 0),
                    0
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder for future metrics */}
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
            <h2 className="text-sm font-semibold text-slate-300">
              Next metrics to unlock
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Track more dimensions of your day – deep work streaks, average
              start time, or time-to-first-task.
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              We can extend the LLM prompt + schema to compute these and store
              them alongside your existing metrics.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
