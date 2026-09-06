// lib/apiAuth.ts
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "./auth";

/**
 * Defence in depth behind `middleware.ts`, which already rejects unauthenticated
 * API calls. Route handlers still call this so they stay safe if the matcher
 * ever changes.
 */
export async function verifyRequestAuthorized(req: NextRequest): Promise<boolean> {
  return verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);
}
