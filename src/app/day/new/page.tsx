import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { DayView } from "@/components/day/DayView";
import { getDayByDate } from "@/lib/days";
import { getToday } from "@/lib/serverTime";
import { DatePicker } from "@/components/day/DatePicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log a day" };

type Props = { searchParams: Promise<{ date?: string | string[] }> };

export default async function NewDayPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;
  const today = await getToday();

  // No date given: log today. Keeps "Log" a single tap from anywhere.
  if (!raw) redirect("/dashboard");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) redirect("/dashboard");
  if (raw === today) redirect("/dashboard");

  const day = await getDayByDate(raw);

  return (
    <AppShell backHref="/dashboard" backLabel="Dashboard">
      <div className="space-y-4">
        <DatePicker value={raw} today={today} />
        <DayView day={day} date={raw} today={today} />
      </div>
    </AppShell>
  );
}
