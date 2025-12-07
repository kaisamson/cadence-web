// app/login/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DASHBOARD_PASSWORD = process.env.CADENCE_DASHBOARD_PASSWORD;

async function login(formData: FormData) {
  "use server";

  const password = formData.get("password");
  const from = (formData.get("from") as string | null) ?? "/dashboard";

  const DASHBOARD_PASSWORD = process.env.CADENCE_DASHBOARD_PASSWORD;
  if (!DASHBOARD_PASSWORD) {
    throw new Error("CADENCE_DASHBOARD_PASSWORD not set");
  }

  if (password !== DASHBOARD_PASSWORD) {
    redirect("/login?error=1");
  }

  // FIX: cookies() must be awaited.
  const cookieStore = await cookies();

  cookieStore.set("cadence_auth", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <h1 className="mb-4 text-2xl font-semibold">Cadence Login</h1>
        <p className="mb-4 text-sm text-slate-400">
          Enter your password to view your Cadence dashboard.
        </p>

        {showError && (
          <p className="mb-3 text-sm text-red-400">
            Incorrect password. Please try again.
          </p>
        )}

        <form action={login} className="space-y-4">
          <input type="hidden" name="from" value={from} />
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
