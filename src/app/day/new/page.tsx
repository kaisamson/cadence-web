import { Suspense } from "react";
import NewDayPage from "./_inner";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-400">Loading…</div>}>
      <NewDayPage />
    </Suspense>
  );
}
