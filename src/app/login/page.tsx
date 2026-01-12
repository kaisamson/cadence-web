// app/login/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DASHBOARD_PASSWORD = process.env.CADENCE_DASHBOARD_PASSWORD;

async function login(formData: FormData) {
  "use server";

  const password = formData.get("password");
  const from = (formData.get("from") as string | null) ?? "/dashboard";

  if (!DASHBOARD_PASSWORD) {
    throw new Error("CADENCE_DASHBOARD_PASSWORD not set");
  }

  if (password !== DASHBOARD_PASSWORD) {
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();

  cookieStore.set("cadence_auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(from);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const showError = params.error === "1";
  const from = params.from ?? "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <h1 className="mb-2 text-2xl font-semibold text-white/95">
          Cadence Login
        </h1>
        <p className="mb-5 text-sm text-white/60">
          Enter your password to view your Cadence dashboard.
        </p>

        {showError && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Incorrect password. Please try again.
          </div>
        )}

        <form action={login} className="space-y-4">
          <input type="hidden" name="from" value={from} />

          <div>
            <label className="mb-1 block text-sm font-medium text-white/80">
              Password
            </label>
            <input
              type="password"
              name="password"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white/90 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
          >
            Log in
          </button>

          <p className="pt-1 text-center text-[11px] text-white/45">
            Authorized access only.
          </p>
        </form>
      </div>
    </main>
  );
}
