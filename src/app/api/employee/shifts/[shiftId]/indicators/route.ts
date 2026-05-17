import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { calculateSalary } from "@/lib/salary-calculator";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { shiftId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get current shift data
    const shiftRes = await query(
      `SELECT s.*, u.full_name, c.id as club_id, c.inventory_settings,
              EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE COALESCE(c.timezone, 'Europe/Moscow')) - s.check_in)) / 3600.0 as hours_worked
         FROM shifts s
         JOIN users u ON s.user_id = u.id
         JOIN clubs c ON s.club_id = c.id
         WHERE s.id = $1 AND s.user_id = $2`,
      [shiftId, userId],
    );

    if (shiftRes.rowCount === 0) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }
    const shift = shiftRes.rows[0];
    const inventorySettings =
      typeof shift.inventory_settings === "string"
        ? JSON.parse(shift.inventory_settings)
        : shift.inventory_settings || {};

    // 2. Get salary scheme
    const schemeRes = await query(
      `SELECT ss.standard_monthly_shifts, sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY sv.version DESC
             LIMIT 1`,
      [userId, shift.club_id],
    );

    const schemeRow = schemeRes.rows[0];
    const scheme = schemeRow
      ? {
          ...(schemeRow.formula || {}),
          standard_monthly_shifts: schemeRow.standard_monthly_shifts,
        }
      : null;

    // 3. Calculate preliminary salary
    const currentHours = Math.max(0, Number(shift.hours_worked) || 0);

    const evaluationsRes = await query(
      `SELECT template_id, total_score as score_percent FROM evaluations WHERE shift_id = $1`,
      [shiftId],
    );

    // Fetch maintenance tasks for this shift
    const shiftStart = new Date(shift.check_in);
    const shiftEnd = shift.check_out ? new Date(shift.check_out) : new Date();

    const tasksRes = await query(
      `SELECT mt.id, mt.status, mt.updated_at, mt.due_date, mt.bonus_earned, mt.task_type,
              e.name as equipment_name, w.name as workstation_name, w.zone as workstation_zone
       FROM equipment_maintenance_tasks mt
       LEFT JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       WHERE mt.club_id = $1 AND mt.assigned_user_id = $2 AND mt.created_at <= $3`,
      [shift.club_id, userId, shiftEnd.toISOString()],
    );

    const shiftTasks = tasksRes.rows.filter((t: any) => {
      if (t.status !== "COMPLETED" || !t.updated_at) return false;
      const d = new Date(t.updated_at);
      return d >= shiftStart && d <= shiftEnd;
    });

    const shiftRawSum = shiftTasks.reduce(
      (sum: number, t: any) => sum + (parseFloat(t.bonus_earned) || 0),
      0,
    );

    const nowTime = new Date().getTime();

    const translateTaskType = (
      type: string,
      equipName: string,
      zone?: string,
    ) => {
      let label = "";
      switch (type) {
        case "CLEANING":
          label = "Чистка";
          break;
        case "THERMAL_PASTE":
          label = "Замена термопасты";
          break;
        case "PERFORMANCE_CHECK":
          label = "Замер производительности";
          break;
        case "REPAIR":
          label = "Ремонт";
          break;
        case "INSPECTION":
          label = "Инспекция";
          break;
        case "REPLACEMENT":
          label = "Замена";
          break;
        default:
          label = type;
      }
      const location = zone ? ` (${zone})` : "";
      return `${label} ${equipName}${location}`.toUpperCase();
    };

    const displayDetails = tasksRes.rows
      .filter((t: any) => {
        if (t.status === "COMPLETED") {
          if (!t.updated_at) return false;
          const d = new Date(t.updated_at);
          return d >= shiftStart && d <= shiftEnd;
        } else {
          if (!t.due_date) return false;
          // due_date is just 'YYYY-MM-DD', so we treat it as end of that day in club timezone
          return new Date(t.due_date).getTime() < nowTime;
        }
      })
      .map((t: any) => ({
        name: translateTaskType(
          t.task_type,
          t.workstation_name || t.equipment_name || "Оборудование",
          t.workstation_zone,
        ),
        status: t.status === "COMPLETED" ? "DONE" : "OVERDUE",
        reward: parseFloat(t.bonus_earned) || 0,
      }));

    const maintenanceStats = {
      completed: shiftTasks.length,
      total: tasksRes.rows.filter(
        (t) =>
          t.status === "COMPLETED" ||
          (t.due_date && new Date(t.due_date).getTime() < nowTime),
      ).length,
      overdue: displayDetails.filter((d: any) => d.status === "OVERDUE").length,
      raw_sum: shiftRawSum,
      details: displayDetails,
    };
    // Calculate POS revenue for reconciliation
    const posRevenueRes = await query(
      `SELECT
         COALESCE(SUM(total_amount), 0) as pos_revenue,
         COUNT(id) as receipts_count
       FROM shift_receipts
       WHERE shift_id = $1 AND voided_at IS NULL AND committed_at IS NOT NULL
         AND payment_type != \'salary\'`,
      [shiftId],
    );
    const posRevenue = Number(posRevenueRes.rows[0].pos_revenue || 0);
    const receiptsCount = Number(posRevenueRes.rows[0].receipts_count || 0);

    // Fetch detailed bar purchases
    const barPurchasesRes = await query(
      `SELECT sr.created_at as date,
              (sri.selling_price_snapshot * sri.quantity) as amount,
              wp.name as product_name
       FROM shift_receipts sr
       JOIN shift_receipt_items sri ON sr.id = sri.receipt_id
       JOIN warehouse_products wp ON sri.product_id = wp.id
       WHERE sr.salary_target_shift_id = $1
         AND sr.payment_type = 'salary'
         AND sr.voided_at IS NULL
       ORDER BY sr.created_at ASC`,
      [shiftId],
    );
    const detailedBarPurchases = barPurchasesRes.rows;
    const totalBarPurchases = detailedBarPurchases.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    let calculation: any = {
      breakdown: {
        base: 0,
        bonuses: [],
        deductions: [],
        total: 0,
        virtual_balance_total: 0,
        instant_payout: 0,
        accrued_payout: 0,
      },
    };

    if (scheme) {
      calculation = await calculateSalary(
        {
          id: shiftId,
          total_hours: currentHours,
          report_data: shift.report_data || {},
          evaluations: evaluationsRes.rows,
          bar_purchases: totalBarPurchases,
        },
        scheme,
        {
          // Metrics for calculation
          total_revenue:
            (Number(shift.cash_income || shift.report_data?.cash_income) || 0) +
            (Number(shift.card_income || shift.report_data?.card_income) || 0),
          maintenance_raw_sum: shiftRawSum,
          maintenance_tasks_completed: shiftTasks.length,
          maintenance_tasks_assigned: tasksRes.rows.length,
          ...shift.report_data,
        },
      );
    }

    if (calculation.breakdown) {
      calculation.breakdown.total_hours = currentHours;

      if (calculation.breakdown.deductions) {
        calculation.breakdown.deductions =
          calculation.breakdown.deductions.filter(
            (d: any) => d.name !== "Бар (в счёт зарплаты)",
          );
        calculation.breakdown.deductions.push(...detailedBarPurchases);
      }
    }

    // 4. Return instant payout amount and indicators
    const averageCheck = receiptsCount > 0 ? posRevenue / receiptsCount : 0;

    return NextResponse.json({
      projected_instant_payout: calculation?.breakdown?.instant_payout || 0,
      calculated_revenue: posRevenue,
      receipts_count: receiptsCount,
      average_check: averageCheck,
      shift_earnings: calculation?.breakdown?.base || 0,
      kpi_bonus: (calculation?.breakdown?.bonuses || []).reduce(
        (sum: number, b: any) => sum + (Number(b.amount) || 0),
        0,
      ),
      inventory_settings: inventorySettings,
      maintenance: maintenanceStats,
      breakdown: calculation?.breakdown || null,
    });
  } catch (error: any) {
    console.error("Get Indicators Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shiftId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { shiftId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { indicators } = await request.json();

    // 1. Verify shift is ACTIVE and belongs to the user
    const shiftRes = await query(
      `SELECT id, status, club_id FROM shifts WHERE id = $1 AND user_id = $2`,
      [shiftId, userId],
    );

    if (shiftRes.rowCount === 0) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const shift = shiftRes.rows[0];
    if (shift.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "Shift is not active. Use the standard report to update closed shifts.",
        },
        { status: 400 },
      );
    }

    // 2. Update report_data (intermediate indicators)
    // We preserve existing data and merge new indicators
    await query(
      `UPDATE shifts
             SET report_data = COALESCE(report_data::jsonb, '{}'::jsonb) || $1::jsonb
             WHERE id = $2`,
      [JSON.stringify(indicators), shiftId],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Update Indicators Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
