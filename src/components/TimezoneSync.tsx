"use client";

import { useEffect } from "react";

/**
 * Reports the browser's IANA timezone to the server once, via cookie, so that
 * server-rendered "today" matches the user's wall clock rather than the
 * deployment region's.
 */
export function TimezoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith("cadence_tz="))
        ?.split("=")[1];
      if (current === encodeURIComponent(tz)) return;

      document.cookie = `cadence_tz=${encodeURIComponent(tz)}; path=/; max-age=${
        60 * 60 * 24 * 365
      }; samesite=lax`;
      // The server rendered this page with a possibly-wrong date; refresh once
      // now that it can know better.
      if (current === undefined) location.reload();
    } catch {
      /* Intl unavailable — the server default stands. */
    }
  }, []);

  return null;
}
