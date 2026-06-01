import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { generateMonthlySalaryReport } from "@/lib/salary-engine";

async function getConfiguredHourlyRate(
  clubId: string | number,
  userId: string,
): Promise<number> {
  try {
    const querySql = `
      WITH user_roles AS (
        SELECT role_id, priority
        FROM club_employee_roles
        WHERE club_id = $1 AND user_id = $2
        ORDER BY priority ASC
      ),
      assigned_scheme AS (
        -- 1. Try to find a role-specific scheme based on club_employee_roles priority
        SELECT ersa.scheme_id, 1 as priority_group, ur.priority as sub_priority
        FROM employee_role_salary_assignments ersa
        JOIN user_roles ur ON ersa.role_id = ur.role_id
        WHERE ersa.club_id = $1 AND ersa.user_id = $2
        
        UNION ALL
        
        -- 2. Fall back to user's main role in users table
        SELECT ersa.scheme_id, 2 as priority_group, 0 as sub_priority
        FROM users u
        JOIN employee_role_salary_assignments ersa ON ersa.role_id = u.role_id
        WHERE u.id = $2 AND ersa.club_id = $1 AND ersa.user_id = $2
        
        UNION ALL
        
        -- 3. Fall back to direct employee salary assignment
        SELECT esa.scheme_id, 3 as priority_group, 0 as sub_priority
        FROM employee_salary_assignments esa
        WHERE esa.club_id = $1 AND esa.user_id = $2
      )
      SELECT s.id as scheme_id, s.name as scheme_name, v.formula
      FROM assigned_scheme a
      JOIN salary_schemes s ON s.id = a.scheme_id
      JOIN LATERAL (
        SELECT formula
        FROM salary_scheme_versions
        WHERE scheme_id = s.id
        ORDER BY version DESC
        LIMIT 1
      ) v ON true
      WHERE s.club_id = $1 AND s.is_active = true
      ORDER BY a.priority_group ASC, a.sub_priority ASC
      LIMIT 1
    `;

    const res = await query(querySql, [clubId, userId]);
    if (res.rowCount && res.rowCount > 0) {
      const formula = (res.rows[0].formula || {}) as any;
      const type = formula.base?.type || formula.type || "hourly";
      const amount = formula.base?.amount ?? formula.amount ?? 0;
      
      if (type === "hourly") {
        return amount;
      } else if (type === "fixed" || type === "per_shift") {
        const fullShiftHours = formula.base?.full_shift_hours ?? formula.full_shift_hours ?? 12;
        return fullShiftHours > 0 ? amount / fullShiftHours : 0;
      }
    }
  } catch (error) {
    console.error("Error in getConfiguredHourlyRate:", error);
  }
  return 0;
}

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
      `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if (employeeCheck.rowCount === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(
      searchParams.get("month") || (now.getMonth() + 1).toString(),
    );
    const year = parseInt(
      searchParams.get("year") || now.getFullYear().toString(),
    );

    // Fetch the unified report from SalaryEngine
    const { reports } = await generateMonthlySalaryReport(clubId, month, year);

    const empReport = reports.find(
      (r) => String(r.employee_id) === String(userId),
    );

    if (!empReport) {
      const fallbackRate = await getConfiguredHourlyRate(clubId, userId);
      return NextResponse.json({
        today_hours: 0,
        week_hours: 0,
        total_hours: 0,
        month_earnings: 0,
        hourly_rate: fallbackRate,
        kpi_bonus: 0,
        is_hourly_rate: true,
        breakdown: {
          base_salary: 0,
          additions: [],
          deductions: [],
          virtual_bonuses: [],
          total_kpi_bonuses: 0,
          virtual_total: 0,
        },
        leaderboard: null,
        standard_monthly_shifts: 15,
        completed_shifts_count: 0,
      });
    }

    // Calculate today and week hours from shifts
    let todayHours = 0;
    let weekHours = 0;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(
      now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1),
    );
    startOfWeek.setHours(0, 0, 0, 0);

    const legacyEmp = empReport._legacy_summary_format;
    const shifts = legacyEmp?.shifts || [];
    let activeShiftsCount = 0;

    shifts.forEach((s: any) => {
      const shiftDate = new Date(s.date);
      const hours = parseFloat(s.total_hours || 0);

      if (s.status === "ACTIVE") activeShiftsCount++;

      if (shiftDate.toDateString() === now.toDateString()) {
        todayHours += hours;
      }
      if (shiftDate >= startOfWeek) {
        weekHours += hours;
      }
    });

    const completed_shifts_count = shifts.length - activeShiftsCount;

    // Map SalaryEngine components to clean UI lists
    const additions: any[] = [];
    const deductions: any[] = [];
    const virtualBonuses: any[] = [];

    let totalKpiReal = 0;
    let totalVirtual = 0;

    empReport.breakdown.bonuses.forEach((b) => {
      const isVirtual = b.payout_type === "VIRTUAL_BALANCE";
      const item = {
        name: b.name,
        amount: b.amount,
        type: b.type,
        original_type: b.original_type,
        is_met: b.is_met,
        progress: b.progress_percent,
      };

      if (isVirtual) {
        virtualBonuses.push(item);
        totalVirtual += b.amount;
      } else {
        additions.push(item);
        // Only count as "KPI" if it's not a basic shift bonus
        if (b.type !== "SHIFT_BONUS") {
          totalKpiReal += b.amount;
        }
      }
    });

    empReport.breakdown.deductions.forEach((d) => {
      deductions.push({
        name: d.name,
        amount: d.amount,
        type: d.type,
      });
    });

    let hourlyRate =
      completed_shifts_count > 0 && empReport.metrics.total_hours > 0
        ? empReport.breakdown.base_salary / empReport.metrics.total_hours
        : 0;

    if (hourlyRate === 0) {
      hourlyRate = await getConfiguredHourlyRate(clubId, userId);
    }

    return NextResponse.json({
      today_hours: todayHours,
      week_hours: weekHours,
      total_hours: empReport.metrics.total_hours,
      month_earnings: empReport.totals.accrued_real,
      hourly_rate: hourlyRate,
      kpi_bonus: totalKpiReal,
      is_hourly_rate: empReport.is_hourly_rate,
      breakdown: {
        base_salary: empReport.breakdown.base_salary,
        additions,
        deductions,
        virtual_bonuses: virtualBonuses,
        total_kpi_bonuses: totalKpiReal,
        virtual_total: totalVirtual,
      },
      leaderboard: legacyEmp?.leaderboard || null,
      standard_monthly_shifts: empReport.metrics.planned_shifts,
      completed_shifts_count: completed_shifts_count,
    });
  } catch (error) {
    console.error("Get Employee Stats Error Detail:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
