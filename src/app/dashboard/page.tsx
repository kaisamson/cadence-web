import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { WeekStrip } from "@/components/dashboard/WeekStrip";
import { GoalsCard } from "@/components/goals/GoalsCard";
import { TodayPanel } from "@/components/dashboard/TodayPanel";
import { TrendChart } from "@/components/charts/TrendChart";
import { StatTile, EmptyState } from "@/components/ui/primitives";
import { getAllDays, getDayByDate, type DaySummary } from "@/lib/days";
import { getToday } from "@/lib/serverTime";
import { averageSleep, percentChange, signalShare } from "@/lib/metrics";
import { formatShortDate, lastNDates, startOfWeek } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trends" };

type Props = { searchParams: Promise<{ week?: string | string[] }> };

/** Sum the derived metrics across a set of dates. */
function totalsFor(dates: string[], byDate: Map<string, DaySummary>) {
  let productiveHours = 0;
  let wastedHours = 0;
  let neutralHours = 0;
  let untrackedHours = 0;
  let deepWorkHours = 0;
  let loggedDays = 0;

  for (const date of dates) {
    const day = byDate.get(date);
    if (!day) continue;
    loggedDays++;
    productiveHours += day.metrics.productiveHours;
    wastedHours += day.metrics.wastedHours;
    neutralHours += day.metrics.neutralHours;
    untrackedHours += day.metrics.untrackedHours;
    deepWorkHours += day.metrics.deepWorkHours;
  }

  return { productiveHours, wastedHours, neutralHours, untrackedHours, deepWorkHours, loggedDays };
}

export default async function DashboardPage({ searchParams }: Props) {
  const [days, today, params] = await Promise.all([
    getAllDays(),
    getToday(),
    searchParams,
  ]);

  const todayRecord = await getDayByDate(today);

  const byDate = new Map(days.map((d) => [d.date, d]));

  const weekParamRaw = Array.isArray(params.week) ? params.week[0] : params.week;
  const weekStart =
    weekParamRaw && /^\d{4}-\d{2}-\d{2}$/.test(weekParamRaw)
      ? startOfWeek(weekParamRaw)
      : startOfWeek(today);

  /* --- Last 7 days vs the 7 before, so every number has a baseline --- */
  const last7 = lastNDates(7, today);
  const prior7 = lastNDates(14, today).slice(0, 7);

  const current = totalsFor(last7, byDate);
  const previous = totalsFor(prior7, byDate);

  const currentShare = signalShare(current);
  const previousShare = signalShare(previous);

  const last14 = lastNDates(14, today);
  const sleepSeries = last14.map((d) => byDate.get(d)?.metrics.sleepHours ?? null);
  const signalSeries = last14.map((d) => byDate.get(d)?.metrics.productiveHours ?? null);

  const avgSleep = averageSleep(sleepSeries);

  if (days.length === 0) {
    return (
      <AppShell>
        <div className="space-y-5">
          <TodayPanel day={todayRecord} date={today} />
          <EmptyState
            title="Nothing logged yet"
            body="Record your first recap above and your week, trends and breakdown will appear here."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <TodayPanel day={todayRecord} date={today} />

        <div className="border-t border-line pt-5">
          <h2 className="text-lg font-semibold tracking-tight">This week</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Last 7 days, compared with the 7 before.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile
            label="Signal"
            value={current.productiveHours.toFixed(1)}
            unit="h"
            delta={percentChange(current.productiveHours, previous.productiveHours)}
            goodDirection="up"
          />
          <StatTile
            label="Noise"
            value={current.wastedHours.toFixed(1)}
            unit="h"
            delta={percentChange(current.wastedHours, previous.wastedHours)}
            goodDirection="down"
          />
          <StatTile
            label="Signal share"
            value={currentShare != null ? currentShare.toFixed(0) : "–"}
            unit="%"
            delta={percentChange(currentShare, previousShare)}
            goodDirection="up"
            hint="of active time"
          />
          <StatTile
            label="Deep work"
            value={current.deepWorkHours.toFixed(1)}
            unit="h"
            delta={percentChange(current.deepWorkHours, previous.deepWorkHours)}
            goodDirection="up"
            hint="in 45+ min stretches"
          />
        </div>

        <WeekStrip weekStart={weekStart} daysByDate={byDate} today={today} />

        <div className="grid gap-4 md:grid-cols-2">
          <TrendChart
            title="Sleep"
            subtitle={
              avgSleep != null
                ? `Last 14 days · ${avgSleep.toFixed(1)}h average`
                : "Last 14 days"
            }
            dates={last14}
            values={sleepSeries}
            unit="h"
            tone="text-rest"
            target={{ value: 8, label: "8h" }}
          />
          <TrendChart
            title="Signal hours"
            subtitle="Last 14 days"
            dates={last14}
            values={signalSeries}
            unit="h"
            tone="text-signal"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <GoalsCard />

          <div className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Where the week went</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {current.loggedDays} of 7 days logged
            </p>

            <dl className="mt-3 space-y-2.5">
              <Breakdown label="Signal" hours={current.productiveHours} tone="bg-signal" total={current} />
              <Breakdown label="Upkeep" hours={current.neutralHours} tone="bg-upkeep" total={current} />
              <Breakdown label="Noise" hours={current.wastedHours} tone="bg-noise" total={current} />
              <Breakdown label="Unaccounted" hours={current.untrackedHours} tone="hatch-unknown" total={current} />
            </dl>

            {current.untrackedHours > current.productiveHours && (
              <p className="mt-3 rounded-lg border border-unknown/30 bg-unknown/10 px-3 py-2 text-[11px] text-ink-muted">
                More of your week is unaccounted for than accounted as signal.
                Adding detail to your recaps will sharpen every number here.
              </p>
            )}
          </div>
        </div>

        <RecentDays days={days.slice(0, 10)} />
      </div>
    </AppShell>
  );
}

function Breakdown({
  label,
  hours,
  tone,
  total,
}: {
  label: string;
  hours: number;
  tone: string;
  total: { productiveHours: number; wastedHours: number; neutralHours: number; untrackedHours: number };
}) {
  const sum =
    total.productiveHours + total.wastedHours + total.neutralHours + total.untrackedHours;
  const pct = sum > 0 ? (hours / sum) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <dt className="text-ink-muted">{label}</dt>
        <dd className="tabular-nums text-ink">
          {hours.toFixed(1)}h
          <span className="ml-1.5 text-ink-faint">{pct.toFixed(0)}%</span>
        </dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecentDays({ days }: { days: DaySummary[] }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Recent days</h2>
      <ul className="mt-3 divide-y divide-line">
        {days.map((day) => (
          <li key={day.id}>
            <Link
              href={`/day/${day.id}`}
              className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-75"
            >
              <span className="w-14 shrink-0 text-xs tabular-nums text-ink-muted">
                {formatShortDate(day.date)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink/85">
                {day.summary ?? "No summary"}
              </span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-signal">
                {day.metrics.productiveHours.toFixed(1)}h
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
