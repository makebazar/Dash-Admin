import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { searchParams } = new URL(request.url);
        const now = new Date();
        const month = parseInt(searchParams.get('month') || (now.getMonth() + 1).toString());
        const year = parseInt(searchParams.get('year') || now.getFullYear().toString());

        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // Fetch report template to get metric categories
        // Fetch current active report template for this club
        const templateRes = await query(
            `SELECT schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );
        const templateSchema = templateRes.rows[0]?.schema;
        const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema?.fields || []);

        // Fetch system metrics for default categories
        const systemMetricsRes = await query(`SELECT key, category, type FROM system_metrics`);
        const systemMetricsMap: Record<string, any> = {};
        systemMetricsRes.rows.forEach(m => { systemMetricsMap[m.key] = m; });

        // Map of metric key -> category AND label
        const metricMetadata: Record<string, { label: string, category: string, is_numeric: boolean }> = {};
        fields.forEach((f: any) => {
            const key = f.metric_key || f.key;
            if (key) {
                const sys = systemMetricsMap[key];
                let category = f.field_type || f.calculation_category;

                // Fallback to system defaults or heuristics
                if (!category) {
                    if (key.includes('income') || key.includes('revenue') || key === 'cash' || key === 'card') {
                        category = 'INCOME';
                    } else if (key.includes('expense') || key === 'expenses') {
                        category = 'EXPENSE';
                    } else {
                        category = 'OTHER';
                    }
                }

                metricMetadata[key] = {
                    label: f.custom_label || f.employee_label || f.label || f.name || key,
                    category: category,
                    is_numeric: sys?.type !== 'TEXT' && !key.includes('comment')
                };
            }
        });

        // Backward compatibility map for categories
        const metricCategories: Record<string, string> = {};
        Object.keys(metricMetadata).forEach(key => {
            metricCategories[key] = metricMetadata[key].category;
        });

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Get employees with their schemes
        const employeesRes = await query(
            `SELECT 
                u.id, 
                u.full_name, 
                r.name as role,
                s.period_bonuses,
                s.standard_monthly_shifts
             FROM club_employees ce
             JOIN users u ON ce.user_id = u.id
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN employee_salary_assignments esa ON u.id = esa.user_id
             LEFT JOIN salary_schemes s ON esa.scheme_id = s.id
             WHERE ce.club_id = $1`,
            [clubId]
        );

        // Get shifts for the period
        const shiftsRes = await query(
            `SELECT 
                id,
                user_id,
                calculated_salary,
                total_hours,
                cash_income,
                card_income,
                report_data,
                salary_snapshot,
                salary_breakdown,
                status,
                check_in
             FROM shifts
             WHERE club_id = $1 
               AND check_in >= $2 
               AND check_in <= $3
               AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')`,
            [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );

        // Helper to calculate "Total Income" based on categories
        const calculateShiftIncome = (shift: any) => {
            let total = 0;
            // 1. Add standard columns if they are INCOME (default for cash/card)
            if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) {
                total += parseFloat(shift.cash_income || 0);
            }
            if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) {
                total += parseFloat(shift.card_income || 0);
            }

            // 2. Add custom report data marked as INCOME
            if (shift.report_data) {
                const data = typeof shift.report_data === 'string' ? JSON.parse(shift.report_data) : shift.report_data;
                Object.keys(data).forEach(key => {
                    if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                        total += parseFloat(data[key] || 0);
                    }
                });
            }
            return total;
        };

        // Get planned shifts for the period
        const plannedShiftsRes = await query(
            `SELECT user_id, planned_shifts 
             FROM employee_shift_schedules 
             WHERE club_id = $1 AND month = $2 AND year = $3`,
            [clubId, month, year]
        );

        // Get payments summary
        const paymentsRes = await query(
            `SELECT user_id, SUM(amount) as total_paid
             FROM payments
             WHERE club_id = $1 AND month = $2 AND year = $3
             GROUP BY user_id`,
            [clubId, month, year]
        );

        // Get payment history
        const paymentHistoryRes = await query(
            `SELECT id, user_id, amount, payment_method, payment_type, created_at
             FROM payments
             WHERE club_id = $1 AND month = $2 AND year = $3
             ORDER BY created_at DESC`,
            [clubId, month, year]
        );

        // Calculate summary
        const summary = employeesRes.rows.map(emp => {
            const empShifts = shiftsRes.rows.filter((s: any) => s.user_id === emp.id);
            const empPayment = paymentsRes.rows.find((p: any) => p.user_id === emp.id);
            const empPlannedShifts = plannedShiftsRes.rows.find((p: any) => p.user_id === emp.id);
            const empPaymentHistory = paymentHistoryRes.rows
                .filter((p: any) => p.user_id === emp.id)
                .slice(0, 3); // Last 3 payments

            const total_accrued = empShifts.reduce((sum: number, s: any) => sum + parseFloat(s.calculated_salary || '0'), 0);
            const total_paid = parseFloat(empPayment?.total_paid || '0');

            // 1. Consolidate shift filtering
            // workingShifts: All shifts that are not special bonus "shifts"
            const workingShifts = empShifts.filter((s: any) => !s.salary_snapshot || s.salary_snapshot.type !== 'PERIOD_BONUS');
            // finishedShifts: Shifts that actually contributed to metrics and salary (not ACTIVE)
            const finishedShifts = workingShifts.filter((s: any) => s.status !== 'ACTIVE');

            const shifts_count = finishedShifts.length;
            const planned_shifts = empPlannedShifts?.planned_shifts || 20; // Default 20

            console.log(`[KPI Debug] Employee ${emp.id}: planned_shifts=${planned_shifts}, finished_shifts=${shifts_count}, total_working=${workingShifts.length}`);

            // Check if shifts have paid snapshot - use it instead of current scheme
            const hasPaidSnapshot = empShifts.some((s: any) => s.salary_snapshot?.paid_at);
            const activeScheme = hasPaidSnapshot
                ? empShifts.find((s: any) => s.salary_snapshot?.paid_at)?.salary_snapshot
                : emp;

            // Calculate Period Bonuses using active scheme (snapshot or current)
            let bonuses_status: any[] = [];
            try {
                const period_bonuses = activeScheme?.period_bonuses || emp.period_bonuses;
                if (Array.isArray(period_bonuses)) {
                    bonuses_status = period_bonuses.map((bonus: any) => {
                        try {
                            let current_value = 0;

                            const existingAccrual = empShifts.find((s: any) =>
                                s.salary_snapshot?.type === 'PERIOD_BONUS' &&
                                s.salary_snapshot?.metric_key === bonus.metric_key
                            );

                            if (bonus.metric_key === 'total_revenue') {
                                current_value = finishedShifts.reduce((sum: number, s: any) => sum + calculateShiftIncome(s), 0);
                            } else if (bonus.metric_key === 'total_hours') {
                                current_value = finishedShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_hours || '0'), 0);
                            } else {
                                current_value = finishedShifts.reduce((sum: number, s: any) => {
                                    const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                                    const val = data?.[bonus.metric_key];
                                    return sum + (typeof val === 'number' ? val : parseFloat(val || '0'));
                                }, 0);
                            }

                            let target_value = 0;
                            let progress_percent = 0;
                            let is_met = false;
                            let current_reward_value = bonus.reward_value;
                            let current_reward_type = bonus.reward_type;

                            if (bonus.type === 'PROGRESSIVE' && Array.isArray(bonus.thresholds) && bonus.thresholds.length > 0) {
                                const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));

                                // NEW LOGIC: Use standard_monthly_shifts (Эталон) as denominator
                                const standard_shifts = activeScheme?.standard_monthly_shifts || emp.standard_monthly_shifts || 15;

                                const scaledThresholds = sorted.map((t: any) => {
                                    const threshold_from = t.from || 0;
                                    // Default to "MONTH" mode for backward compatibility if bonus_mode not set
                                    const mode = bonus.bonus_mode || 'MONTH';

                                    let scaled_from = threshold_from;
                                    if (mode === 'SHIFT') {
                                        // "Per Shift" mode: From * Actual Shifts
                                        scaled_from = threshold_from * shifts_count;
                                    } else {
                                        // "Per Month" mode: (From / Standard) * Actual Shifts
                                        scaled_from = (threshold_from / standard_shifts) * shifts_count;
                                    }

                                    return {
                                        from: scaled_from,
                                        original_from: threshold_from,
                                        percent: t.percent || 0,
                                        label: t.label || null
                                    };
                                });
                                bonus.thresholds = scaledThresholds;

                                let metThresholdIndex = -1;
                                for (let i = scaledThresholds.length - 1; i >= 0; i--) {
                                    if (current_value >= scaledThresholds[i].from) {
                                        metThresholdIndex = i;
                                        break;
                                    }
                                }

                                // Only award bonus if at least first threshold is met and employee has shifts
                                if (metThresholdIndex >= 0 && shifts_count > 0) {
                                    is_met = true;
                                    current_reward_value = scaledThresholds[metThresholdIndex].percent;
                                    current_reward_type = 'PERCENT';

                                    if (metThresholdIndex < scaledThresholds.length - 1) {
                                        target_value = scaledThresholds[metThresholdIndex + 1].from;
                                    } else {
                                        target_value = scaledThresholds[metThresholdIndex].from;
                                    }
                                } else {
                                    // First threshold NOT met - no bonus
                                    is_met = false;
                                    // If zero shifts, show the original threshold for clarity, otherwise the scaled one
                                    target_value = shifts_count > 0 ? scaledThresholds[0].from : sorted[0].from;
                                    current_reward_value = 0;
                                    current_reward_type = 'PERCENT';
                                }

                                progress_percent = target_value > 0 ? (current_value / target_value) * 100 : 0;

                            } else {
                                // TARGET mode handles... (same logic as before but with standard_shifts)
                                const standard_shifts = activeScheme?.standard_monthly_shifts || emp.standard_monthly_shifts || 15;
                                const mode = bonus.bonus_mode || 'MONTH';

                                if (mode === 'SHIFT') {
                                    target_value = shifts_count * (bonus.target_per_shift || 0);
                                } else {
                                    target_value = (bonus.target_per_shift || 0) / standard_shifts * shifts_count;
                                }

                                progress_percent = target_value > 0 ? (current_value / target_value) * 100 : (shifts_count > 0 ? 100 : 0);
                                is_met = shifts_count > 0 && current_value >= target_value;
                            }

                            return {
                                ...bonus,
                                current_value,
                                target_value,
                                progress_percent,
                                is_met,
                                is_accrued: !!existingAccrual,
                                current_reward_value,
                                current_reward_type
                            };
                        } catch (err) {
                            console.error('Error calculating bonus:', bonus, err);
                            return { ...bonus, error: 'Calculation failed' };
                        }
                    });
                }
            } catch (e) {
                console.error('Error processing bonuses for emp:', emp.id, e);
            }

            // Calculate KPI bonus (from metric values, not base salary!)
            const kpi_bonus_amount = bonuses_status
                .filter((b: any) => b.is_met && b.current_reward_type === 'PERCENT')
                .reduce((sum: number, b: any) => {
                    // Use the metric's current_value, not total_accrued
                    const bonusAmount = b.current_value * (b.current_reward_value / 100);
                    return sum + bonusAmount;
                }, 0);

            // Add KPI to total
            const total_with_kpi = total_accrued + kpi_bonus_amount;

            // Calculate performance metrics using finishedShifts
            const total_revenue = finishedShifts.reduce((sum: number, s: any) => sum + calculateShiftIncome(s), 0);
            const total_hours = finishedShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_hours || '0'), 0);

            // Revenue breakdown by metric
            const revenue_by_metric: any = {};
            const display_bonuses = activeScheme?.period_bonuses || emp.period_bonuses;
            if (Array.isArray(display_bonuses)) {
                display_bonuses.forEach((bonus: any) => {
                    if (bonus.metric_key) {
                        const metric_total = finishedShifts.reduce((sum: number, s: any) => {
                            if (bonus.metric_key === 'total_revenue') {
                                return sum + parseFloat(s.total_revenue || '0');
                            } else if (bonus.metric_key === 'total_hours') {
                                return sum + parseFloat(s.total_hours || '0');
                            } else {
                                const val = s.report_data?.[bonus.metric_key];
                                return sum + (typeof val === 'number' ? val : parseFloat(val || '0'));
                            }
                        }, 0);

                        revenue_by_metric[bonus.metric_key] = {
                            total: metric_total,
                            avg_per_shift: shifts_count > 0 ? metric_total / shifts_count : 0
                        };
                    }
                });
            }

            return {
                id: emp.id,
                full_name: emp.full_name,
                role: emp.role,
                shifts_count,
                planned_shifts, // DEBUG - show planned shifts in response
                total_accrued: total_with_kpi,
                total_paid,
                balance: total_with_kpi - total_paid,
                period_bonuses: bonuses_status,
                kpi_bonus_amount,
                // New detailed data
                breakdown: {
                    base_salary: total_accrued,
                    kpi_bonuses: kpi_bonus_amount,
                    other_bonuses: 0 // TODO: implement if needed
                },
                metrics: {
                    total_revenue,
                    avg_revenue_per_shift: shifts_count > 0 ? total_revenue / finishedShifts.length : 0,
                    total_hours,
                    avg_hours_per_shift: shifts_count > 0 ? total_hours / finishedShifts.length : 0,
                    revenue_by_metric
                },
                payment_history: empPaymentHistory.map((p: any) => ({
                    id: p.id,
                    date: p.created_at,
                    amount: parseFloat(p.amount),
                    method: p.payment_method,
                    payment_type: p.payment_type || 'salary'
                })),
                shifts: [
                    // 1. Inject dynamic monthly KPI if earned
                    ...(kpi_bonus_amount > 0 ? [{
                        id: `dynamic-kpi-${emp.id}`,
                        date: new Date().toISOString(),
                        total_hours: 0,
                        total_revenue: 0,
                        calculated_salary: kpi_bonus_amount,
                        kpi_bonus: kpi_bonus_amount,
                        status: 'CALCULATED',
                        is_paid: false,
                        type: 'PERIOD_BONUS'
                    }] : []),
                    // 2. Real shifts from DB
                    ...empShifts.map((s: any) => {
                        const breakdown = s.salary_breakdown || {};
                        const kpiBonus = s.salary_snapshot?.type === 'PERIOD_BONUS'
                            ? parseFloat(s.calculated_salary || '0')
                            : (breakdown.bonuses?.reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0) || 0);

                        return {
                            id: s.id,
                            date: s.check_in,
                            total_hours: parseFloat(s.total_hours || '0'),
                            total_revenue: calculateShiftIncome(s),
                            calculated_salary: parseFloat(s.calculated_salary || '0'),
                            kpi_bonus: kpiBonus,
                            status: s.status,
                            is_paid: !!(s.salary_snapshot?.paid_at),
                            type: s.salary_snapshot?.type || 'REGULAR',
                            // Add extra metrics for KPI source display
                            metrics: typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data || {},
                            bonuses: breakdown.bonuses || []
                        };
                    })
                ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                metric_categories: metricCategories,
                metric_metadata: metricMetadata
            };
        });

        return NextResponse.json({ summary });

    } catch (error: any) {
        console.error('Salary Summary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
