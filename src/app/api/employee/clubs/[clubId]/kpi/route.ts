import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateMonthlySalaryReport } from "@/lib/salary-engine";

// GET: Get employee's KPI progress for current period
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Call the Single Source of Truth
    const { reports } = await generateMonthlySalaryReport(clubId, month, year);

    // Find current user's report
    const reportItem = reports.find(
      (r: any) => String(r.employee_id) === String(userId),
    );
    const userReport = reportItem?._legacy_summary_format;

    if (!userReport) {
      return NextResponse.json({
        kpi: [],
        checklist: [],
        maintenance: null,
        hidden: true,
        message: "Нет данных для выбранного периода",
      });
    }

    if (!userReport.has_kpi_feature) {
      return NextResponse.json({
        kpi: [],
        checklist: [],
        maintenance: null,
        hidden: true,
      });
    }

    const periodBonuses = userReport.period_bonuses || [];
    const shiftBonusesBreakdown = Array.isArray(userReport.shift_bonuses_breakdown)
      ? userReport.shift_bonuses_breakdown
      : [];

    // Filter and map period bonuses
    const mappedPeriodBonuses = periodBonuses
      .filter(
        (b: any) =>
          b.type === "progressive_bonus" ||
          b.type === "progressive_percent" ||
          b.type === "PROGRESSIVE" ||
          b.type === "per_unit",
      )
      .map((b: any) => ({
        ...b,
        type:
          b.type === "progressive_percent" || b.type === "PROGRESSIVE" || b.type === "progressive_bonus"
            ? "revenue"
            : b.type === "per_unit"
              ? "promo"
              : b.type,
      }));

    // Separate kpi (revenue) and promo (per_unit) period bonuses
    const kpi = mappedPeriodBonuses.filter((b: any) => b.type === "revenue");
    const periodPromo = mappedPeriodBonuses.filter((b: any) => b.type === "promo");

    // Map shift bonuses to 'promo' format so they appear as KPI cards
    const mappedShiftBonuses = shiftBonusesBreakdown.map((b: any) => {
      const isPercent = b.original_type === "progressive_percent" || b.original_type === "percent_revenue";
      const earned = b.amount || b.total_earned || 0;
      const count = isPercent ? (b.source_value || 0) : (b.count || 0);
      const reward_value = isPercent
        ? (count > 0 ? (earned / count) * 100 : 0)
        : (b.count > 0 ? earned / b.count : 0);
      const reward_type = isPercent ? "PERCENT" : "FIXED";
      const source = isPercent
        ? (b.source_key === "Bar" ? "Выручка бара (sum)" : "Выручка (sum)")
        : "За смены";

      return {
        id: b.id || `shift-${b.name}`,
        type: "promo",
        name: b.name,
        bonus_amount: earned,
        current_value: count,
        mode: "SHIFT",
        metric_key: isPercent ? "sum" : undefined,
        thresholds: b.thresholds || undefined,
        threshold_counts: b.threshold_counts || undefined,
        metric_breakdown: [
          {
            source,
            count,
            earned,
            reward_value,
            reward_type,
          },
        ],
        rules: [
          {
            source,
            reward_type,
            percent: isPercent ? reward_value : 0,
            amount: isPercent ? 0 : reward_value,
            rate: isPercent ? 0 : reward_value,
          },
        ],
      };
    });

    const promo = [...periodPromo, ...mappedShiftBonuses];

    const checklist = userReport.checklist_bonuses || [];
    
    let maintenance = null;
    if (userReport.maintenance_status) {
      const ms = userReport.maintenance_status;
      maintenance = {
        ...ms,
        total_month_target: ms.target_value || 0,
        completed_month_value: ms.current_value || 0,
        total_gross: ms.base_bonus_amount || 0,
      };
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = daysInMonth - currentDay;
    const remaining_future_shifts = Math.max(
      0,
      (userReport.planned_shifts || 0) - (userReport.shifts_count || 0),
    );

    return NextResponse.json({
      kpi,
      promo,
      checklist,
      maintenance,
      shifts_count: userReport.shifts_count || 0,
      completed_shifts_count: userReport.shifts_count || 0,
      planned_shifts: userReport.planned_shifts || 0,
      remaining_shifts: remaining_future_shifts,
      days_remaining: remainingDays,
      current_day: currentDay,
      days_in_month: daysInMonth,
      hidden: false,
    });
  } catch (error) {
    console.error("Error fetching employee KPI:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
