// lib/serverTime.ts
//
// "Today" must mean the user's local today. Server components run in the
// deployment's timezone (UTC on Vercel), so deriving the date from the server
// clock silently rolls the day over at 7pm Eastern — exactly when an evening
// recap gets logged. We resolve a real IANA zone instead.

import { cookies } from "next/headers";

export const TZ_COOKIE = "cadence_tz";

const FALLBACK_TZ = process.env.CADENCE_TIMEZONE || "America/Toronto";

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's timezone: browser-reported if known, else the configured default. */
export async function getUserTimeZone(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(TZ_COOKIE)?.value;
  if (fromCookie && isValidTimeZone(fromCookie)) return fromCookie;
  return isValidTimeZone(FALLBACK_TZ) ? FALLBACK_TZ : "UTC";
}

/** YYYY-MM-DD for "now" in the given zone. en-CA formats as ISO by default. */
export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Convenience: the viewer's local date string, server-side. */
export async function getToday(): Promise<string> {
  return todayInZone(await getUserTimeZone());
}
