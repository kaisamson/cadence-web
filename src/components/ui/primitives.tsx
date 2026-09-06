import Link from "next/link";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={`rounded-card border border-line bg-surface ${className}`}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface/50 p-6 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">{body}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * A single headline number, with an optional comparison against the previous
 * period. Direction is explicit because "up" is good for focus hours and bad
 * for wasted hours.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  goodDirection = "up",
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  goodDirection?: "up" | "down";
  hint?: string;
}) {
  const showDelta = delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.5;
  const improving = delta != null && (goodDirection === "up" ? delta > 0 : delta < 0);

  return (
    <div className="rounded-card border border-line bg-surface p-3.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums leading-none text-ink">
          {value}
        </span>
        {unit && <span className="text-xs text-ink-muted">{unit}</span>}
      </div>
      {showDelta ? (
        <div
          className={`mt-1.5 text-[11px] font-medium tabular-nums ${
            improving ? "text-signal" : "text-noise"
          }`}
        >
          {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs prev
        </div>
      ) : (
        hint && <div className="mt-1.5 text-[11px] text-ink-faint">{hint}</div>
      )}
    </div>
  );
}
