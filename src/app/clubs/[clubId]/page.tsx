import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";

// Data layer
import { getDashboardAccess } from "./_queries/access";
import { getReportMetricMeta } from "./_queries/shiftStats";
import { getRevenueTrendForDates } from "./_queries/revenueTrend";
import { getRevenueInsights } from "./_queries/revenueInsights";
import { getAdminPerformance } from "./_queries/adminPerformance";
import { getActiveShiftsSnapshot, getNextScheduledShift } from "./_queries/shiftsSnapshot";
import { getAttentionSnapshot } from "./_queries/attentionSnapshot";

// UI components
import { ClubPageHeader } from "./_components/ClubPageHeader";
import { RevenueInsightsGrid } from "./_components/RevenueInsightsGrid";
import { EmployeesSection } from "./_components/EmployeesSection";
import { AttentionSection } from "./_components/AttentionSection";
import RevenueTrendChart from "./RevenueTrendChart";

import type { RevenuePoint } from "./_types";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { clubId } = await params;
  const { days: daysParam } = await searchParams;
  const days = Number(daysParam) === 7 ? 7 : 30;
  const userId = (await cookies()).get("session_user_id")?.value;

  if (!userId) redirect("/login");

  const access = await getDashboardAccess(clubId);
  const canViewShifts = access.permissions.view_shifts;

  const metricMeta = await getReportMetricMeta(clubId);
  let currentTrend: RevenuePoint[] = [];
  let previousTrend: RevenuePoint[] = [];
  let currentStart: Date;
  let currentEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (days === 7) {
    const now = new Date();
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    currentStart = new Date(currentEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    currentStart.setHours(0, 0, 0, 0);
    prevEnd = new Date(currentStart.getTime() - 1000);
    prevStart = new Date(prevEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    prevStart.setHours(0, 0, 0, 0);

    const [curT, prevT] = await Promise.all([
      getRevenueTrendForDates(clubId, currentStart, currentEnd),
      getRevenueTrendForDates(clubId, prevStart, prevEnd),
    ]);
    currentTrend = curT;
    previousTrend = prevT;
  } else {
    const now = new Date();
    const currentDay = now.getDate();
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    currentEnd = new Date(now.getFullYear(), now.getMonth(), currentDay, 23, 59, 59, 999);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [curT, prevT] = await Promise.all([
      getRevenueTrendForDates(clubId, currentStart, currentEnd),
      getRevenueTrendForDates(clubId, prevStart, prevEnd),
    ]);
    currentTrend = curT;
    previousTrend = prevT;
  }

  // Trim trailing zero days
  while (currentTrend.length > 1) {
    const lastItem = currentTrend[currentTrend.length - 1];
    if (lastItem.revenue === 0 && lastItem.receiptsCount === 0) {
      currentTrend.pop();
    } else {
      break;
    }
  }

  if (days === 7) {
    while (previousTrend.length < currentTrend.length) {
      previousTrend.push({ date: "", revenue: 0, receiptsCount: 0 });
    }
    while (previousTrend.length > currentTrend.length) {
      previousTrend.pop();
    }
  }

  // Like-for-Like boundaries for admin performance comparison
  const lastTrendItem = currentTrend[currentTrend.length - 1];
  const activeCurrentEnd = lastTrendItem
    ? new Date(lastTrendItem.date + "T23:59:59")
    : currentEnd;
  const lflDays = currentTrend.length;
  const activePrevEnd = new Date(prevStart.getTime());
  activePrevEnd.setDate(activePrevEnd.getDate() + lflDays - 1);
  activePrevEnd.setHours(23, 59, 59, 999);

  const [
    revenueInsights,
    attentionSnapshot,
    activeShifts,
    nextScheduledShift,
    adminPerformance,
  ] = await Promise.all([
    getRevenueInsights(clubId, 84),
    getAttentionSnapshot(clubId),
    canViewShifts ? getActiveShiftsSnapshot(clubId) : Promise.resolve([]),
    canViewShifts ? getNextScheduledShift(clubId) : Promise.resolve(null),
    canViewShifts
      ? getAdminPerformance(clubId, currentStart, activeCurrentEnd, prevStart, activePrevEnd)
      : Promise.resolve([]),
  ]);

  return (
    <PageShell maxWidth="5xl">
      <ClubPageHeader clubName={access.clubName} />

      <div className="flex flex-col gap-12">
        {/* 1. Revenue */}
        <div>
          <RevenueTrendChart
            currentData={currentTrend}
            previousData={previousTrend}
            days={days}
            clubId={clubId}
            metricMeta={metricMeta}
          />
          <RevenueInsightsGrid insights={revenueInsights.insights} />
        </div>

        <hr className="border-slate-200" />

        {/* 2. Employees */}
        <EmployeesSection
          activeShifts={activeShifts}
          nextScheduledShift={nextScheduledShift}
          adminPerformance={adminPerformance}
        />

        <hr className="border-slate-200" />

        {/* 3. Attention Needed */}
        <AttentionSection snapshot={attentionSnapshot} clubId={clubId} />
      </div>
    </PageShell>
  );
}
