"use client";

import Link from "next/link";
import { TimezoneSync } from "./TimezoneSync";

/**
 * Chrome only. Cadence is a single-page dashboard — there is no tab bar,
 * because there is only one place to be. The one drill-down is a specific day.
 */
export function AppShell({
  children,
  backHref,
  backLabel,
}: {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TimezoneSync />

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true">
              <path
                d="M8 32h9l6-14 9 28 7-18 5 4h12"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Cadence
          </Link>

          {backHref && (
            <Link
              href={backHref}
              className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-line-strong hover:text-ink"
            >
              ← {backLabel ?? "Back"}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}
