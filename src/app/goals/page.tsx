import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { GoalsCard } from "@/components/goals/GoalsCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            What &ldquo;signal&rdquo; is supposed to add up to.
          </p>
        </header>
        <GoalsCard />
      </div>
    </AppShell>
  );
}
