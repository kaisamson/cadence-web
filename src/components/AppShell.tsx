"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TimezoneSync } from "./TimezoneSync";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Extra path prefixes that should also light this tab up. */
  match?: string[];
};

function IconToday() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrends() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 15.5l4.5-5 3.5 3.5L20 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGoals() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const NAV: NavItem[] = [
  { href: "/today", label: "Today", icon: <IconToday />, match: ["/day"] },
  { href: "/dashboard", label: "Trends", icon: <IconTrends /> },
  { href: "/goals", label: "Goals", icon: <IconGoals /> },
];

function useActive(pathname: string) {
  return (item: NavItem) =>
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    (item.match?.some((m) => pathname.startsWith(m)) ?? false);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = useActive(pathname);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TimezoneSync />

      {/* Desktop / tablet top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-line bg-canvas/80 backdrop-blur-md sm:block">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
          <Link href="/today" className="mr-4 flex items-center gap-2 font-semibold tracking-tight">
            <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
              <path d="M8 32h9l6-14 9 28 7-18 5 4h12" fill="none" stroke="currentColor"
                    strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cadence
          </Link>

          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                isActive(item)
                  ? "bg-surface-2 text-ink"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}

          <Link
            href="/day/new"
            className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            Log a day
          </Link>
        </div>
      </header>

      {/* Mobile top bar — title only; navigation lives in the thumb zone */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur-md sm:hidden">
        <Link href="/today" className="flex items-center gap-2 font-semibold tracking-tight">
          <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
            <path d="M8 32h9l6-14 9 28 7-18 5 4h12" fill="none" stroke="currentColor"
                  strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Cadence
        </Link>
        <Link
          href="/day/new"
          className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-canvas"
        >
          Log
        </Link>
      </header>

      {/* pb-24 on mobile clears the fixed tab bar */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 sm:pb-10">{children}</main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-3">
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  // 56px min target — comfortably above the 44px touch minimum
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-ink" : "text-ink-faint",
                ].join(" ")}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
