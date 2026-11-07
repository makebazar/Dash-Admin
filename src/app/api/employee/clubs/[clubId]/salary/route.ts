import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { generateMonthlySalaryReport } from "@/lib/salary-engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify employee belongs to club
    const employeeCheck = await query(
      `SELECT ce.user_id, u.full_name, r.name as role_name
       FROM club_employees ce
       JOIN users u ON u.id = ce.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ce.club_id = $1 AND ce.user_id = $2`,
      [clubId, userId],
    );

    if (employeeCheck.rowCount === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(
      searchParams.get("month") || (now.getMonth() + 1).toString(),
      10,
    );
    const year = parseInt(
      searchParams.get("year") || now.getFullYear().toString(),
      10,
    );

    // Get club timezone and name
    const clubRes = await query(
      `SELECT id, name, timezone FROM clubs WHERE id = $1`,
      [clubId],
    );
    const club = clubRes.rows[0] || {
      id: Number(clubId),
      name: "Клуб",
      timezone: "Europe/Moscow",
    };

    // Fetch unified monthly report from SalaryEngine
    const { reports } = await generateMonthlySalaryReport(
      clubId,
      month,
      year,
    );

    const empReport = reports.find(
      (r) => String(r.employee_id) === String(userId),
    );

    const userInfo = employeeCheck.rows[0];

    if (!empReport) {
      // Zero-state report for employee in a month without shifts or payments
      return NextResponse.json({
        period: { month, year },
        club: {
          id: club.id,
          name: club.name,
          timezone: club.timezone || "Europe/Moscow",
        },
        employee: {
          id: userId,
          full_name: userInfo.full_name,
          role: userInfo.role_name || "Сотрудник",
          shifts_count: 0,
          planned_shifts: 15,
          standard_monthly_shifts: 15,
          total_accrued: 0,
          total_paid: 0,
          balance: 0,
          virtual_balance_accrued: 0,
          virtual_balance: 0,
          payment_status: "PENDING",
          is_hourly_rate: true,
          breakdown: {
            base_salary: 0,
            virtual_balance: 0,
            kpi_bonuses: 0,
            other_bonuses: 0,
            salary_deduction: 0,
            instant_payout: 0,
            accrued_payout: 0,
            bonuses: [],
            deductions: [],
          },
          metrics: {
            total_hours: 0,
            total_revenue: 0,
            avg_revenue_per_shift: 0,
            evaluation_score: 0,
            evaluation_count: 0,
          },
          shifts: [],
          period_bonuses: [],
          checklist_bonuses: [],
          shift_bonuses_breakdown: [],
          maintenance_status: null,
          payment_history: [],
          bar_details: [],
          leaderboard: null,
        },
      });
    }

    const legacyEmp = empReport._legacy_summary_format || {};

    return NextResponse.json({
      period: { month, year },
      club: {
        id: club.id,
        name: club.name,
        timezone: club.timezone || "Europe/Moscow",
      },
      employee: {
        id: userId,
        full_name:
          legacyEmp.full_name || empReport.full_name || userInfo.full_name,
        role:
          legacyEmp.role || empReport.role || userInfo.role_name || "Сотрудник",
        shifts_count:
          empReport.metrics.completed_shifts ?? legacyEmp.shifts_count ?? 0,
        planned_shifts:
          empReport.metrics.planned_shifts ?? legacyEmp.planned_shifts ?? 15,
        standard_monthly_shifts: legacyEmp.standard_monthly_shifts ?? 15,
        total_accrued:
          empReport.totals.accrued_real ?? legacyEmp.total_accrued ?? 0,
        total_paid: empReport.totals.paid_real ?? legacyEmp.total_paid ?? 0,
        balance: empReport.totals.balance_real ?? legacyEmp.balance ?? 0,
        virtual_balance_accrued:
          empReport.totals.accrued_virtual ??
          legacyEmp.virtual_balance_accrued ??
          0,
        virtual_balance:
          empReport.totals.balance_virtual ?? legacyEmp.virtual_balance ?? 0,
        payment_status:
          (empReport.totals.balance_real ?? legacyEmp.balance ?? 0) <= 0
            ? "PAID"
            : (empReport.totals.paid_real ?? legacyEmp.total_paid ?? 0) > 0
              ? "PARTIAL"
              : "PENDING",
        is_hourly_rate: empReport.is_hourly_rate,
        breakdown: {
          base_salary:
            empReport.breakdown.base_salary ??
            legacyEmp.breakdown?.base_salary ??
            0,
          virtual_balance: legacyEmp.breakdown?.virtual_balance ?? 0,
          kpi_bonuses: legacyEmp.breakdown?.kpi_bonuses ?? 0,
          other_bonuses: legacyEmp.breakdown?.other_bonuses ?? 0,
          salary_deduction: legacyEmp.breakdown?.salary_deduction ?? 0,
          instant_payout: legacyEmp.breakdown?.instant_payout ?? 0,
          accrued_payout: legacyEmp.breakdown?.accrued_payout ?? 0,
          bonuses: empReport.breakdown.bonuses || [],
          deductions: (empReport.breakdown.deductions || []).filter(
            (d: any) => d.type !== "MAINTENANCE_PENALTY",
          ),
        },
        metrics: {
          ...legacyEmp.metrics,
          ...empReport.metrics,
        },
        shifts: legacyEmp.shifts || [],
        period_bonuses: legacyEmp.period_bonuses || [],
        checklist_bonuses: legacyEmp.checklist_bonuses || [],
        shift_bonuses_breakdown: legacyEmp.shift_bonuses_breakdown || [],
        maintenance_status: legacyEmp.maintenance_status || null,
        payment_history: legacyEmp.payment_history || [],
        bar_details: legacyEmp.bar_details || [],
        leaderboard: legacyEmp.leaderboard || null,
      },
    });
  } catch (error) {
    console.error("Get Employee Salary Report Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
