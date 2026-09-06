import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { DayView } from "@/components/day/DayView";
import { getDayById } from "@/lib/days";
import { getToday } from "@/lib/serverTime";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const day = await getDayById(id);
  return { title: day ? formatDate(day.date) : "Day not found" };
}

export default async function DayDetailPage(props: Props) {
  const { id } = await props.params;
  const [day, today] = await Promise.all([getDayById(id), getToday()]);

  if (!day) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <h1 className="text-lg font-semibold">Day not found</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">
            That link doesn&apos;t point at a day in your log — it may have been deleted.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-canvas hover:opacity-90"
          >
            Back to trends
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DayView day={day} date={day.date} today={today} />
    </AppShell>
  );
}
