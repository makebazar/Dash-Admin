import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get employee's KPI progress for current period
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current month/year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get employee's salary scheme
        const schemeRes = await query(
            `SELECT ss.*, esa.scheme_id
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON ss.id = esa.scheme_id
             WHERE esa.user_id = $1 AND esa.club_id = $2
             ORDER BY esa.assigned_at DESC
             LIMIT 1`,
            [userId, clubId]
        );

        if (schemeRes.rowCount === 0) {
            return NextResponse.json({ kpi: [], message: 'No salary scheme assigned' });
        }

        const scheme = schemeRes.rows[0];
        const period_bonuses = scheme.period_bonuses || [];

        // Get planned shifts for this period
        const plannedRes = await query(
            `SELECT planned_shifts FROM employee_shift_schedules
             WHERE club_id = $1 AND user_id = $2 AND month = $3 AND year = $4`,
            [clubId, userId, month, year]
        );
        const planned_shifts = plannedRes.rows[0]?.planned_shifts || 20;

        // Get finished shifts this period
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const shiftsRes = await query(
            `SELECT 
                COUNT(*) as shifts_count,
                COALESCE(SUM(cash_income + card_income), 0) as total_revenue,
                COALESCE(SUM(total_hours), 0) as total_hours
             FROM shifts
             WHERE user_id = $1 
               AND club_id = $2 
               AND check_in >= $3 
               AND check_in <= $4
               AND check_out IS NOT NULL`,
            [userId, clubId, startOfMonth, endOfMonth]
        );

        const shifts_count = parseInt(shiftsRes.rows[0]?.shifts_count || '0');
        const total_revenue = parseFloat(shiftsRes.rows[0]?.total_revenue || '0');

        // Get report_data aggregated values for metric-based KPIs
        const reportDataRes = await query(
            `SELECT report_data FROM shifts
             WHERE user_id = $1 AND club_id = $2 
               AND check_in >= $3 AND check_in <= $4
               AND check_out IS NOT NULL
               AND report_data IS NOT NULL`,
            [userId, clubId, startOfMonth, endOfMonth]
        );

        const revenue_by_metric: Record<string, number> = { total_revenue };
        reportDataRes.rows.forEach((row: any) => {
            const data = row.report_data || {};
            Object.entries(data).forEach(([key, val]) => {
                const numVal = parseFloat(val as string) || 0;
                revenue_by_metric[key] = (revenue_by_metric[key] || 0) + numVal;
            });
        });

        // Days in month for projection
        const daysInMonth = new Date(year, month, 0).getDate();
        const currentDay = now.getDate();
        const remainingDays = daysInMonth - currentDay;
        const remainingShifts = planned_shifts - shifts_count;

        // Calculate KPI progress with MONTHLY thresholds (not scaled)
        const kpi_progress = period_bonuses.map((bonus: any) => {
            const metric_key = bonus.metric_key || 'total_revenue';
            const current_value = revenue_by_metric[metric_key] || 0;
            const avg_per_shift = shifts_count > 0 ? current_value / shifts_count : 0;

            let current_level = 0;
            let current_reward = 0;
            let is_met = false;
            let all_thresholds: any[] = [];

            if (bonus.type === 'PROGRESSIVE' && bonus.thresholds?.length) {
                const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));

                // Build all thresholds with MONTHLY values (original, not scaled)
                all_thresholds = sorted.map((t: any, idx: number) => {
                    const monthlyThreshold = t.from || 0;
                    // Scale threshold to current progress for comparison
                    const scaledThreshold = planned_shifts > 0
                        ? monthlyThreshold / planned_shifts * shifts_count
                        : monthlyThreshold;
                    const isMet = shifts_count > 0 && current_value >= scaledThreshold;

                    // Calculate remaining needed (total - current)
                    const totalNeededForLevel = monthlyThreshold;
                    const remainingToLevel = totalNeededForLevel - current_value;

                    // Per shift to REACH this level (only for remaining shifts)
                    const perShiftToReach = remainingShifts > 0 && remainingToLevel > 0
                        ? remainingToLevel / remainingShifts
                        : 0;

                    // Per shift to STAY at this level (if already met)
                    // Need to maintain pace: (threshold / planned_shifts) per shift
                    const perShiftToStay = planned_shifts > 0
                        ? monthlyThreshold / planned_shifts
                        : 0;

                    const potentialBonus = monthlyThreshold * (t.percent / 100);

                    return {
                        level: idx + 1,
                        monthly_threshold: monthlyThreshold,
                        scaled_threshold: scaledThreshold,
                        percent: t.percent || 0,
                        is_met: isMet,
                        remaining_total: isMet ? 0 : remainingToLevel,
                        per_shift_to_reach: perShiftToReach,
                        per_shift_to_stay: perShiftToStay,
                        potential_bonus: potentialBonus
                    };
                });

                // Find current level
                for (let i = all_thresholds.length - 1; i >= 0; i--) {
                    if (all_thresholds[i].is_met) {
                        current_level = i + 1;
                        current_reward = all_thresholds[i].percent;
                        is_met = true;
                        break;
                    }
                }
            }

            const bonus_amount = is_met && current_reward > 0
                ? current_value * (current_reward / 100)
                : 0;

            // Projection: if we continue with avg_per_shift
            const projected_total = current_value + (avg_per_shift * remainingShifts);
            let projected_level = 0;
            let projected_bonus = 0;

            if (bonus.type === 'PROGRESSIVE' && all_thresholds.length > 0) {
                for (let i = all_thresholds.length - 1; i >= 0; i--) {
                    if (projected_total >= all_thresholds[i].monthly_threshold) {
                        projected_level = i + 1;
                        projected_bonus = projected_total * (all_thresholds[i].percent / 100);
                        break;
                    }
                }
            }

            return {
                id: bonus.id,
                name: bonus.name,
                metric_key,
                current_value,
                avg_per_shift,
                current_level,
                current_reward,
                is_met,
                bonus_amount,
                all_thresholds,
                // Projection
                projected_total,
                projected_level,
                projected_bonus,
                remaining_shifts: remainingShifts
            };
        });

        const total_kpi_bonus = kpi_progress.reduce((sum: number, kpi: any) => sum + kpi.bonus_amount, 0);
        const total_projected_bonus = kpi_progress.reduce((sum: number, kpi: any) => sum + kpi.projected_bonus, 0);

        return NextResponse.json({
            kpi: kpi_progress,
            total_kpi_bonus,
            total_projected_bonus,
            shifts_count,
            planned_shifts,
            remaining_shifts: planned_shifts - shifts_count,
            days_remaining: remainingDays,
            current_day: currentDay,
            days_in_month: daysInMonth
        });

    } catch (error: any) {
        console.error('Employee KPI Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
