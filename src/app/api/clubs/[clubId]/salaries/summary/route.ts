import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { calculateSalary } from '@/lib/salary-calculator';

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
                s.standard_monthly_shifts,
                v.formula as scheme_formula,
                v.version as scheme_version
             FROM club_employees ce
             JOIN users u ON ce.user_id = u.id
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN employee_salary_assignments esa ON u.id = esa.user_id
             LEFT JOIN salary_schemes s ON esa.scheme_id = s.id
             LEFT JOIN LATERAL (
                 SELECT formula, version 
                 FROM salary_scheme_versions 
                 WHERE scheme_id = s.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE ce.club_id = $1`,
            [clubId]
        );

        // Process employees to merge formula into the object structure expected by logic
        const employees = employeesRes.rows.map((row: any) => {
            const formula = row.scheme_formula || {};
            return {
                ...row,
                ...formula, // Spread base, bonuses, type, amount etc.
                // Priority to explicit columns if they existed (they don't, but meant to override formula if needed)
                period_bonuses: row.period_bonuses || formula.period_bonuses,
                standard_monthly_shifts: row.standard_monthly_shifts || formula.standard_monthly_shifts
            };
        });

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

        // Get planned shifts for the period from ACTUAL schedule
        const monthStr = month.toString().padStart(2, '0');
        const lastDay = new Date(year, month, 0).getDate();
        const plannedShiftsRes = await query(
            `SELECT user_id, COUNT(*)::int as planned_shifts 
             FROM work_schedules 
             WHERE club_id = $1 
               AND date >= $2 AND date <= $3
             GROUP BY user_id`,
            [clubId, `${year}-${monthStr}-01`, `${year}-${monthStr}-${lastDay}`]
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

        // Get evaluation averages for the period
        const evaluationsRes = await query(
            `SELECT employee_id, AVG(total_score) as avg_score, COUNT(id) as count
             FROM evaluations 
             WHERE club_id = $1 
               AND evaluation_date >= $2 
               AND evaluation_date <= $3
             GROUP BY employee_id`,
            [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );
        const evalMap: Record<number, { avg: number, count: number }> = {};
        evaluationsRes.rows.forEach(r => {
            evalMap[r.employee_id] = { avg: parseFloat(r.avg_score), count: parseInt(r.count) };
        });

        // Process each employee
        const summary = await Promise.all(employees.map(async (emp: any) => {
            const empShifts = shiftsRes.rows.filter((s: any) => s.user_id === emp.id);
            const empPayment = paymentsRes.rows.find((p: any) => p.user_id === emp.id);
            const empPlannedShifts = plannedShiftsRes.rows.find((p: any) => p.user_id === emp.id);
            const empPaymentHistory = paymentHistoryRes.rows
                .filter((p: any) => p.user_id === emp.id)
                .slice(0, 3); // Last 3 payments

            // 0. Pre-calculate monthly totals for KPI metrics
            const finishedShifts = empShifts.filter((s: any) => s.status !== 'ACTIVE' && (!s.salary_snapshot || s.salary_snapshot.type !== 'PERIOD_BONUS'));
            const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };

            finishedShifts.forEach(s => {
                monthlyMetrics.total_revenue += calculateShiftIncome(s);
                monthlyMetrics.total_hours += parseFloat(s.total_hours || 0);
                if (s.report_data) {
                    const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                    Object.keys(data).forEach(key => {
                        monthlyMetrics[key] = (monthlyMetrics[key] || 0) + parseFloat(data[key] || 0);
                    });
                }
            });

            // Add evaluation score to metrics
            const empEval = evalMap[emp.id];
            if (empEval) {
                monthlyMetrics['evaluation_score'] = empEval.avg;
                monthlyMetrics['evaluation_count'] = empEval.count;
            }

            // Fetch maintenance bonuses for this month
            const maintenanceRes = await query(
                `SELECT COALESCE(SUM(bonus_earned), 0) as total_maintenance_bonus
                 FROM equipment_maintenance_tasks mt
                 JOIN equipment e ON mt.equipment_id = e.id
                 WHERE e.club_id = $1 AND mt.completed_by = $2 
                   AND mt.completed_at >= $3 AND mt.completed_at <= $4
                   AND mt.status = 'COMPLETED'`,
                [clubId, emp.id, startOfMonth.toISOString(), endOfMonth.toISOString()]
            );
            const totalMaintenanceBonus = parseFloat(maintenanceRes.rows[0]?.total_maintenance_bonus || 0);

            const monthBonusRes = await query(
                `SELECT COALESCE(SUM(bonus_amount), 0) as total_monthly_bonus
                 FROM maintenance_monthly_bonuses
                 WHERE club_id = $1 AND user_id = $2 AND year = $3 AND month = $4`,
                [clubId, emp.id, startOfMonth.getFullYear(), startOfMonth.getMonth() + 1]
            );
            const totalMonthlyBonus = parseFloat(monthBonusRes.rows[0]?.total_monthly_bonus || 0);

            monthlyMetrics['maintenance_bonus'] = totalMaintenanceBonus + totalMonthlyBonus;

            const shifts_count = finishedShifts.length;
            const planned_shifts = empPlannedShifts?.planned_shifts || 20;
            const hasPaidSnapshot = empShifts.some((s: any) => s.salary_snapshot?.paid_at);
            const activeScheme = hasPaidSnapshot
                ? empShifts.find((s: any) => s.salary_snapshot?.paid_at)?.salary_snapshot
                : emp;

            // 1. Calculate Period Bonuses rewards
            let bonuses_status: any[] = [];
            const period_bonuses = activeScheme?.period_bonuses || emp.period_bonuses;
            if (Array.isArray(period_bonuses)) {
                bonuses_status = period_bonuses.map((bonus: any) => {
                    const current_value = monthlyMetrics[bonus.metric_key] ||
                        (bonus.metric_key === 'total_revenue' ? monthlyMetrics.total_revenue :
                            bonus.metric_key === 'total_hours' ? monthlyMetrics.total_hours : 0);

                    const existingAccrual = empShifts.find((s: any) =>
                        s.salary_snapshot?.type === 'PERIOD_BONUS' &&
                        s.salary_snapshot?.metric_key === bonus.metric_key
                    );

                    let target_value = 0;
                    let progress_percent = 0;
                    let is_met = false;
                    let current_reward_value = bonus.reward_value;
                    let current_reward_type = bonus.reward_type;

                    const standard_shifts = activeScheme?.standard_monthly_shifts || emp.standard_monthly_shifts || 15;
                    const mode = bonus.bonus_mode || 'MONTH';

                    let resultThresholds = bonus.thresholds;

                    if (bonus.type === 'PROGRESSIVE' && Array.isArray(bonus.thresholds) && bonus.thresholds.length > 0) {
                        const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));
                        const scaledThresholds = sorted.map((t: any) => {
                            const threshold_from = t.from || 0;
                            let scaled_from = mode === 'SHIFT' ? threshold_from * shifts_count : (threshold_from / standard_shifts) * shifts_count;
                            return { from: scaled_from, original_from: threshold_from, percent: t.percent || 0, label: t.label || null };
                        });
                        resultThresholds = scaledThresholds;

                        let metThresholdIndex = -1;
                        for (let i = scaledThresholds.length - 1; i >= 0; i--) {
                            if (current_value >= scaledThresholds[i].from) { metThresholdIndex = i; break; }
                        }

                        if (metThresholdIndex >= 0 && shifts_count > 0) {
                            is_met = true;
                            current_reward_value = scaledThresholds[metThresholdIndex].percent;
                            current_reward_type = 'PERCENT';
                            target_value = metThresholdIndex < scaledThresholds.length - 1 ? scaledThresholds[metThresholdIndex + 1].from : scaledThresholds[metThresholdIndex].from;
                        } else {
                            is_met = false;
                            target_value = shifts_count > 0 ? scaledThresholds[0].from : sorted[0].from;
                            current_reward_value = 0;
                            current_reward_type = 'PERCENT';
                        }
                    } else {
                        target_value = mode === 'SHIFT' ? shifts_count * (bonus.target_per_shift || 0) : (bonus.target_per_shift || 0) / standard_shifts * shifts_count;
                        is_met = shifts_count > 0 && current_value >= target_value;
                    }

                    progress_percent = target_value > 0 ? (current_value / target_value) * 100 : (shifts_count > 0 ? 100 : 0);

                    return {
                        ...bonus,
                        thresholds: resultThresholds,
                        current_value,
                        target_value,
                        progress_percent,
                        is_met,
                        is_accrued: !!existingAccrual,
                        current_reward_value,
                        current_reward_type
                    };
                });
            }

            // 2. Process shifts with calculated rewards
            const processedShifts = await Promise.all(empShifts.map(async (s: any) => {
                if (s.salary_snapshot?.paid_at || s.status === 'PAID') {
                    return { ...s, calculated_salary: parseFloat(s.calculated_salary || '0'), breakdown: s.salary_breakdown || {} };
                }

                const reportMetricsForShift: Record<string, number> = {
                    total_revenue: calculateShiftIncome(s),
                    revenue_cash: parseFloat(s.cash_income || 0),
                    revenue_card: parseFloat(s.card_income || 0)
                };

                if (s.report_data) {
                    const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                    Object.keys(data).forEach(key => { reportMetricsForShift[key] = parseFloat(data[key] || 0); });
                }

                // Inject monthly evaluation metrics into shift metrics so bonuses can use them
                if (empEval) {
                    reportMetricsForShift['evaluation_score'] = empEval.avg;
                    reportMetricsForShift['evaluation_count'] = empEval.count;
                }

                // Pass the scheme WITH calculated bonuses reward levels
                const schemeWithRewards = { ...emp, period_bonuses: bonuses_status };

                const result = await calculateSalary(
                    { id: s.id, total_hours: parseFloat(s.total_hours || 0), report_data: s.report_data },
                    schemeWithRewards,
                    reportMetricsForShift
                );

                return { ...s, calculated_salary: result.total, breakdown: result.breakdown };
            }));

            // 3. Totals and final summary data
            const total_accrued = processedShifts.reduce((sum: number, s: any) => sum + (s.calculated_salary || 0), 0);
            const total_paid = parseFloat(empPayment?.total_paid || '0');
            const total_with_kpi = total_accrued; // KPI is now included in individual shifts if percentage-based

            // If any period bonus is FIXED-type and not yet in shifts, we add it back (but for now we assume they are handled)
            const kpi_bonus_amount = bonuses_status
                .filter((b: any) => b.is_met && b.current_reward_type === 'PERCENT')
                .reduce((sum: number, b: any) => {
                    const bonusAmount = b.current_value * (b.current_reward_value / 100);
                    return sum + bonusAmount;
                }, 0);

            const total_revenue = monthlyMetrics.total_revenue;
            const total_hours = monthlyMetrics.total_hours;

            // Revenue breakdown by metric
            const revenue_by_metric: any = {};
            const display_bonuses = activeScheme?.period_bonuses || emp.period_bonuses;
            if (Array.isArray(display_bonuses)) {
                display_bonuses.forEach((bonus: any) => {
                    if (bonus.metric_key) {
                        const metric_total = finishedShifts.reduce((sum: number, s: any) => {
                            if (bonus.metric_key === 'total_revenue') {
                                return sum + calculateShiftIncome(s);
                            } else if (bonus.metric_key === 'total_hours') {
                                return sum + parseFloat(s.total_hours || '0');
                            } else {
                                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                                const val = data?.[bonus.metric_key];
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
                    // 1. Physical shifts from DB
                    ...processedShifts.map((s: any) => {
                        const breakdown = s.breakdown || {};
                        const kpiBonus = breakdown.bonuses?.reduce((sum: number, b: any) =>
                            sum + (b.type === 'PERIOD_BONUS_CONTRIBUTION' || b.type === 'SHIFT_BONUS' ? parseFloat(b.amount) || 0 : 0), 0) || 0;

                        return {
                            id: s.id,
                            date: s.check_in,
                            total_hours: parseFloat(s.total_hours || '0'),
                            total_revenue: calculateShiftIncome(s),
                            calculated_salary: s.calculated_salary,
                            kpi_bonus: kpiBonus,
                            status: s.status,
                            is_paid: !!(s.salary_snapshot?.paid_at),
                            type: s.salary_snapshot?.type || 'REGULAR',
                            metrics: typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data || {},
                            bonuses: breakdown.bonuses || []
                        };
                    })
                ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                metric_categories: metricCategories,
                metric_metadata: metricMetadata
            };
        }));

        // Filter out employees with 0 shifts, unless they have some financial activity (accruals or payments)
        const filteredSummary = summary.filter(emp =>
            emp.shifts_count > 0 ||
            emp.total_accrued !== 0 ||
            emp.total_paid !== 0
        );

        return NextResponse.json({ summary: filteredSummary });

    } catch (error: any) {
        console.error('Salary Summary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
