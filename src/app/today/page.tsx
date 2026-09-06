import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { DayView } from "@/components/day/DayView";
import { getDayByDate } from "@/lib/days";
import { getToday } from "@/lib/serverTime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const today = await getToday();
  const day = await getDayByDate(today);

  return (
    <AppShell>
      <DayView day={day} date={today} today={today} />
    </AppShell>
  );
}
