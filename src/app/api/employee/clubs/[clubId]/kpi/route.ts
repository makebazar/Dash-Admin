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

        // Date boundaries
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // 1. Fetch metric categories to correctly calculate "Total Income"
        const templateRes = await query(
            `SELECT schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );
        const templateSchema = templateRes.rows[0]?.schema;
        const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema?.fields || []);

        const systemMetricsRes = await query(`SELECT key, category, type FROM system_metrics`);
        const systemMetricsMap: Record<string, any> = {};
        systemMetricsRes.rows.forEach(m => { systemMetricsMap[m.key] = m; });

        const metricCategories: Record<string, string> = {};
        fields.forEach((f: any) => {
            const key = f.metric_key || f.key;
            if (key) {
                let category = f.field_type || f.calculation_category;
                if (!category) {
                    if (key.includes('income') || key.includes('revenue') || key === 'cash' || key === 'card') {
                        category = 'INCOME';
                    } else if (key.includes('expense') || key === 'expenses') {
                        category = 'EXPENSE';
                    } else {
                        category = 'OTHER';
                    }
                }
                metricCategories[key] = category;
            }
        });

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
            console.log(`[KPI API] No salary scheme assigned for User ${userId} in Club ${clubId}`);
            return NextResponse.json({ kpi: [], message: 'Схема зарплаты не назначена' });
        }

        const scheme = schemeRes.rows[0];
        console.log(`[KPI API] Found scheme: ${scheme.name} (ID: ${scheme.id}) for User ${userId}`);
        
        const period_bonuses = scheme.period_bonuses || [];
        const standard_monthly_shifts = scheme.standard_monthly_shifts || 15;

        // Get planned shifts from ACTUAL schedule (work_schedules)
        // We count how many shifts are assigned to this user in this month
        // Dates in work_schedules are YYYY-MM-DD strings.
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthStr = month.toString().padStart(2, '0');
        const plannedRes = await query(
            `SELECT COUNT(*) as count FROM work_schedules
             WHERE club_id = $1 AND user_id = $2 
             AND date >= $3 AND date <= $4`,
            [clubId, userId, `${year}-${monthStr}-01`, `${year}-${monthStr}-${daysInMonth}`]
        );
        const planned_shifts = parseInt(plannedRes.rows[0]?.count || '0');
        console.log(`[KPI API] Planned shifts: ${planned_shifts}`);

        const shiftsRes = await query(
            `SELECT 
                id,
                cash_revenue,
                card_revenue,
                total_hours,
                report_data,
                check_in,
                status
             FROM shifts
             WHERE user_id = $1 
               AND club_id = $2 
               AND check_in >= $3 
               AND check_in <= $4
                AND (status IN ('CLOSED', 'PAID', 'VERIFIED') OR (status = 'ACTIVE'))`,
            [userId, clubId, startOfMonth, endOfMonth]
        );

        const finishedShifts = shiftsRes.rows;
        
        // Separate active and closed shifts
        // Handle edge case: multiple active shifts (should not happen, but safe to handle)
        // We take the MOST RECENT active shift as the "current" one.
        const allActiveShifts = finishedShifts.filter(s => s.status === 'ACTIVE');
        const activeShift = allActiveShifts.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())[0];
        
        const closedShifts = finishedShifts.filter(s => s.status !== 'ACTIVE');
        
        const completed_shifts_count = closedShifts.length;
        // Total count logic: closed + (1 if there is an active shift)
        // We ignore "zombie" active shifts if any (extra ones)
        const total_shifts_count = completed_shifts_count + (activeShift ? 1 : 0);
        
        console.log(`[KPI API] Shifts found: ${total_shifts_count} (Closed: ${completed_shifts_count}, Active: ${activeShift ? 1 : 0})`);

        // Calculate totals using the same logic as salary summary
        const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };
        const activeShiftMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };
        const closedShiftsMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };

        finishedShifts.forEach(s => {
            const isActive = s.status === 'ACTIVE';
            // Only process this shift if it is CLOSED or if it is the ONE valid active shift
            if (isActive && s.id !== activeShift?.id) return; 

            // Calculate Shift Income
            let shiftIncome = 0;
            // Use revenue fields from DB
            const cash = parseFloat(s.cash_revenue || 0);
            const card = parseFloat(s.card_revenue || 0);
            
            if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) shiftIncome += cash;
            if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) shiftIncome += card;

            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    const val = parseFloat(data[key] || 0);
                    // Only include INCOME metrics, excluding cash/card duplicates
                    if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                        shiftIncome += val;
                    }
                    
                    // Add to metrics maps
                    monthlyMetrics[key] = (monthlyMetrics[key] || 0) + val;
                    if (isActive) activeShiftMetrics[key] = (activeShiftMetrics[key] || 0) + val;
                    else closedShiftsMetrics[key] = (closedShiftsMetrics[key] || 0) + val;
                });
            }
            monthlyMetrics.total_revenue += shiftIncome;
            monthlyMetrics.total_hours += parseFloat(s.total_hours || 0);

            if (isActive) {
                activeShiftMetrics.total_revenue += shiftIncome;
                activeShiftMetrics.total_hours += parseFloat(s.total_hours || 0);
            } else {
                closedShiftsMetrics.total_revenue = (closedShiftsMetrics.total_revenue || 0) + shiftIncome;
                closedShiftsMetrics.total_hours = (closedShiftsMetrics.total_hours || 0) + parseFloat(s.total_hours || 0);
            }
        });

        // Days in month for projection
        const currentDay = now.getDate();
        const remainingDays = daysInMonth - currentDay;
        
        // REVERTED LOGIC: "Remaining shifts" in UI traditionally means "Future shifts excluding current ones already counted".
        // If we want to show "5 shifts left", and we have 8 shifts (7 closed + 1 active), and plan is 13.
        // Then 13 - 8 = 5.
        // So we should subtract TOTAL shifts (including active) from planned.
        const remaining_future_shifts = Math.max(0, planned_shifts - total_shifts_count);
        
        // But for CALCULATION of "how much to earn per shift", we have:
        // The current active shift (which is not finished) + all future shifts.
        // So we divide by (remaining_future_shifts + (activeShift ? 1 : 0)).
        const shifts_opportunities = remaining_future_shifts + (activeShift ? 1 : 0);

        // Calculate KPI progress with SCALED thresholds (matching salary summary)
        const kpi_progress = period_bonuses.map((bonus: any) => {
            const metric_key = bonus.metric_key || 'total_revenue';
            
            // Current Value (Total for month, including active)
            const current_value = monthlyMetrics[metric_key] ||
                (metric_key === 'total_revenue' ? monthlyMetrics.total_revenue :
                    metric_key === 'total_hours' ? monthlyMetrics.total_hours : 0);
            
            // Value from CLOSED shifts only (for historical average)
            const closed_value = metric_key === 'total_revenue' ? closedShiftsMetrics.total_revenue :
                                 metric_key === 'total_hours' ? closedShiftsMetrics.total_hours :
                                 (closedShiftsMetrics[metric_key] || 0);

            // Average per shift based on COMPLETED shifts only to avoid skewing by partial active shift
            const avg_per_shift = completed_shifts_count > 0 ? closed_value / completed_shifts_count : 0;
            
            const mode = bonus.bonus_mode || 'MONTH';

            let current_level = 0;
            let current_reward = 0;
            let is_met = false;
            let all_thresholds: any[] = [];

            if (bonus.type === 'PROGRESSIVE' && bonus.thresholds?.length) {
                const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));

                // Scale thresholds exactly like in salaries/summary/route.ts
                all_thresholds = sorted.map((t: any, idx: number) => {
                    const original_from = t.from || 0;
                    
                    const scaled_threshold = mode === 'SHIFT'
                        ? original_from * total_shifts_count
                        : (original_from / standard_monthly_shifts) * total_shifts_count;

                    const isThresholdMet = total_shifts_count > 0 && current_value >= scaled_threshold;

                    // Remaining to meet this SCALED threshold
                    const remainingToLevel = Math.max(0, scaled_threshold - current_value);

                    // To REACH: we need to reach the SCALED threshold at the END of the month
                    // So we scale the monthly threshold to the TOTAL planned shifts
                    const endOfMonthThreshold = mode === 'SHIFT'
                        ? original_from * planned_shifts
                        : (original_from / standard_monthly_shifts) * planned_shifts; // Scale MONTH threshold for planned shifts

                    const totalRemainingToReach = Math.max(0, endOfMonthThreshold - current_value);

                    // Distribute remaining target over ALL available shifts (future + current active)
                    const perShiftToReach = shifts_opportunities > 0 ? totalRemainingToReach / shifts_opportunities : 0;
                    const perShiftToStay = planned_shifts > 0 ? endOfMonthThreshold / planned_shifts : 0;

                    const potentialBonus = endOfMonthThreshold * (t.percent / 100);

                    return {
                        level: idx + 1,
                        label: t.label,
                        monthly_threshold: original_from,
                        planned_month_threshold: endOfMonthThreshold,
                        scaled_threshold: scaled_threshold,
                        percent: t.percent || 0,
                        is_met: isThresholdMet,
                        remaining_total: totalRemainingToReach,
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

            const current_bonus_amount = is_met && current_reward > 0
                ? current_value * (current_reward / 100)
                : 0;

            // Projection logic (same as before but based on scaled metrics)
            const projected_total = current_value + (avg_per_shift * remaining_future_shifts);
            let projected_level = 0;
            let projected_bonus = 0;

            if (bonus.type === 'PROGRESSIVE' && all_thresholds.length > 0) {
                for (let i = all_thresholds.length - 1; i >= 0; i--) {
                    const monthlyThreshold = all_thresholds[i].monthly_threshold;
                    const endOfMonthThreshold = mode === 'SHIFT' ? monthlyThreshold * planned_shifts : monthlyThreshold;

                    if (projected_total >= endOfMonthThreshold) {
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
                bonus_amount: current_bonus_amount,
                all_thresholds,
                projected_total,
                projected_level,
                projected_bonus,
                remaining_shifts: remaining_future_shifts,
                current_shift_value: activeShiftMetrics[metric_key] ||
                    (metric_key === 'total_revenue' ? activeShiftMetrics.total_revenue :
                        metric_key === 'total_hours' ? activeShiftMetrics.total_hours : 0)
            };
        });

        const total_kpi_bonus = kpi_progress.reduce((sum: number, kpi: any) => sum + kpi.bonus_amount, 0);
        const total_projected_bonus = kpi_progress.reduce((sum: number, kpi: any) => sum + kpi.projected_bonus, 0);

        return NextResponse.json({
            kpi: kpi_progress,
            total_kpi_bonus,
            total_projected_bonus,
            shifts_count: total_shifts_count, // Revert to TOTAL (including active) for UI "Passed X shifts"
            planned_shifts,
            remaining_shifts: remaining_future_shifts,
            days_remaining: remainingDays,
            current_day: currentDay,
            days_in_month: daysInMonth
        });

    } catch (error: any) {
        console.error('Employee KPI Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
