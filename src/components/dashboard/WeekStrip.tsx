import Link from "next/link";

import type { DaySummary } from "@/lib/days";
import { DayRibbon } from "@/components/day/DayRibbon";
import { addDays, formatShortDate, formatWeekday, startOfWeek, weekDates } from "@/lib/time";

export function WeekStrip({
  weekStart,
  daysByDate,
  today,
}: {
  weekStart: string;
  daysByDate: Map<string, DaySummary>;
  today: string;
}) {
  const dates = weekDates(weekStart);
  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const isCurrentWeek = weekStart === startOfWeek(today);

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Week at a glance</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatShortDate(dates[0])} – {formatShortDate(dates[6])}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <WeekNavLink href={`/dashboard?week=${prev}`} label="Previous week">←</WeekNavLink>
          {!isCurrentWeek && (
            <Link
              href="/dashboard"
              className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:border-line-strong hover:text-ink"
            >
              This week
            </Link>
          )}
          <WeekNavLink href={`/dashboard?week=${next}`} label="Next week">→</WeekNavLink>
        </div>
      </div>

      {/* Mobile: one row per day */}
      <ul className="mt-3 space-y-1.5 sm:hidden">
        {dates.map((date) => (
          <li key={date}>
            <DayRow date={date} day={daysByDate.get(date)} today={today} />
          </li>
        ))}
      </ul>

      {/* Desktop: seven columns */}
      <div className="mt-3 hidden grid-cols-7 gap-2 sm:grid">
        {dates.map((date) => (
          <DayColumn key={date} date={date} day={daysByDate.get(date)} today={today} />
        ))}
      </div>
    </section>
  );
}

function WeekNavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted hover:border-line-strong hover:text-ink"
    >
      {children}
    </Link>
  );
}

function hrefFor(date: string, day: DaySummary | undefined, today: string) {
  if (day) return `/day/${day.id}`;
  // Today's recorder is already on this page; jump to it rather than navigating.
  return date === today ? "/dashboard#log" : `/day/new?date=${date}`;
}

function DayRow({
  date,
  day,
  today,
}: {
  date: string;
  day: DaySummary | undefined;
  today: string;
}) {
  const isToday = date === today;
  const isFuture = date > today;

  const inner = (
    <>
      <div className="flex w-11 shrink-0 flex-col items-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          {formatWeekday(date)}
        </span>
        <span className={`text-sm tabular-nums ${isToday ? "font-bold text-ink" : "text-ink-muted"}`}>
          {date.slice(-2)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {day ? (
          <>
            <DayRibbon events={day.events} showLegend={false} />
            <p className="mt-1.5 line-clamp-1 text-[11px] text-ink-muted">
              {day.summary ?? "No summary"}
            </p>
          </>
        ) : (
          <span className="text-xs text-ink-faint">
            {isFuture ? "—" : "Nothing logged · tap to add"}
          </span>
        )}
      </div>
    </>
  );

  const base =
    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors";
  const tone = isToday
    ? "border-line-strong bg-surface-2"
    : "border-line hover:border-line-strong";

  if (isFuture && !day) {
    return <div className={`${base} border-line opacity-40`}>{inner}</div>;
  }

  return (
    <Link href={hrefFor(date, day, today)} className={`${base} ${tone}`}>
      {inner}
    </Link>
  );
}

function DayColumn({
  date,
  day,
  today,
}: {
  date: string;
  day: DaySummary | undefined;
  today: string;
}) {
  const isToday = date === today;
  const isFuture = date > today;

  const inner = (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          {formatWeekday(date)}
        </span>
        <span className={`text-xs tabular-nums ${isToday ? "font-bold text-ink" : "text-ink-muted"}`}>
          {date.slice(-2)}
        </span>
      </div>

      {day ? (
        <>
          <div className="mt-2">
            <DayRibbon events={day.events} showLegend={false} />
          </div>
          <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-ink-muted">
            {day.summary ?? "No summary"}
          </p>
          <p className="mt-1.5 text-[11px] font-medium tabular-nums text-signal">
            {day.metrics.productiveHours.toFixed(1)}h signal
          </p>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-ink-faint">
          {isFuture ? "—" : "Add"}
        </p>
      )}
    </>
  );

  const base = "flex min-h-32 flex-col rounded-lg border p-2.5 transition-colors";
  const tone = isToday
    ? "border-line-strong bg-surface-2"
    : "border-line hover:border-line-strong";

  if (isFuture && !day) {
    return <div className={`${base} border-line opacity-40`}>{inner}</div>;
  }

  return (
    <Link href={hrefFor(date, day, today)} className={`${base} ${tone}`}>
      {inner}
    </Link>
  );
}
