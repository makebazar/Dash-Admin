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

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Get employees with their schemes
        const employeesRes = await query(
            `SELECT 
                u.id, 
                u.full_name, 
                r.name as role,
                s.period_bonuses
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
                (COALESCE(cash_income, 0) + COALESCE(card_income, 0)) as total_revenue,
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
                                current_value = finishedShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_revenue || '0'), 0);
                            } else if (bonus.metric_key === 'total_hours') {
                                current_value = finishedShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_hours || '0'), 0);
                            } else {
                                current_value = finishedShifts.reduce((sum: number, s: any) => {
                                    const val = s.report_data?.[bonus.metric_key];
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

                                // CORRECT LOGIC: (Threshold / Planned Shifts) × Actual Shifts
                                // Use planned_shifts from snapshot if available
                                const current_planned_shifts = activeScheme?.planned_shifts || planned_shifts;

                                const scaledThresholds = sorted.map((t: any) => ({
                                    from: (t.from || 0) / current_planned_shifts * shifts_count,
                                    percent: t.percent || 0
                                }));

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
                                const current_planned_shifts = activeScheme?.planned_shifts || planned_shifts;
                                target_value = shifts_count > 0
                                    ? shifts_count * (bonus.target_per_shift || 0)
                                    : current_planned_shifts * (bonus.target_per_shift || 0);

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
            const total_revenue = finishedShifts.reduce((sum: number, s: any) => sum + parseFloat(s.total_revenue || '0'), 0);
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
                            total_revenue: parseFloat(s.total_revenue || '0'),
                            calculated_salary: parseFloat(s.calculated_salary || '0'),
                            kpi_bonus: kpiBonus,
                            status: s.status,
                            is_paid: !!(s.salary_snapshot?.paid_at),
                            type: s.salary_snapshot?.type || 'REGULAR'
                        };
                    })
                ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            };
        });

        return NextResponse.json({ summary });

    } catch (error: any) {
        console.error('Salary Summary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
