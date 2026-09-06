import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_COOKIE,
  SESSION_COOKIE_OPTIONS,
  checkPassword,
  createSessionToken,
} from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

/** Only ever redirect to a path on this site, never to an absolute URL. */
function safeRedirectTarget(from: string | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return "/today";
  return from;
}

async function login(formData: FormData) {
  "use server";

  const from = safeRedirectTarget(formData.get("from") as string | null ?? undefined);

  if (!checkPassword(formData.get("password"))) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, await createSessionToken(), SESSION_COOKIE_OPTIONS);

  redirect(from);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const from = safeRedirectTarget(params.from);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden="true">
            <path d="M8 32h9l6-14 9 28 7-18 5 4h12" fill="none" stroke="currentColor"
                  strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Cadence</h1>
            <p className="text-xs text-ink-muted">Own your time.</p>
          </div>
        </div>

        <form action={login} className="rounded-card border border-line bg-surface p-5">
          <input type="hidden" name="from" value={from} />

          {params.error === "1" && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-noise/40 bg-noise/10 px-3 py-2 text-xs text-noise"
            >
              That password didn&apos;t match. Try again.
            </div>
          )}

          <label htmlFor="password" className="block text-xs font-medium text-ink-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-line-strong"
          />

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
