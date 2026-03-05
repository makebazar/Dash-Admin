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
            const periodBonuses = row.period_bonuses || formula.period_bonuses || [];
            const bonuses = formula.bonuses || [];
            
            return {
                ...row,
                ...formula, // Spread base, bonuses, type, amount etc.
                // Priority to explicit columns if they existed (they don't, but meant to override formula if needed)
                period_bonuses: periodBonuses,
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

        // Get payments summary - separate real money and virtual balance
        const paymentsRes = await query(
            `SELECT 
                user_id, 
                SUM(amount) FILTER (WHERE payment_type != 'bonus') as total_paid,
                SUM(amount) FILTER (WHERE payment_type = 'bonus') as total_paid_bonus
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

        // Fetch KPI Config
        const kpiConfigRes = await query(`SELECT * FROM maintenance_kpi_config WHERE club_id = $1`, [clubId]);
        const kpiConfig = kpiConfigRes.rows[0];

        // Get evaluation averages for the period - Calculate percentage correctly
        const evaluationsRes = await query(
            `SELECT 
                employee_id, 
                AVG((total_score / max_score) * 100) as avg_score, 
                COUNT(id) as count
             FROM evaluations 
             WHERE club_id = $1 
               AND evaluation_date >= $2 
               AND evaluation_date <= $3
               AND max_score > 0
             GROUP BY employee_id`,
            [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );
        const evalMap: Record<string, { avg: number, count: number }> = {};
        evaluationsRes.rows.forEach(r => {
            evalMap[r.employee_id.toString()] = { avg: parseFloat(r.avg_score), count: parseInt(r.count) };
        });

        // Fetch individual evaluations to pass them to shift calculation
        const shiftEvalsRes = await query(
            `SELECT 
                shift_id, 
                template_id, 
                total_score, 
                max_score,
                ((total_score / max_score) * 100) as score_percent
             FROM evaluations
             WHERE club_id = $1 
               AND evaluation_date >= $2 
               AND evaluation_date <= $3
               AND shift_id IS NOT NULL
               AND max_score > 0`,
            [clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );
        const shiftEvalsMap: Record<string, any[]> = {};
        shiftEvalsRes.rows.forEach(r => {
            if (!shiftEvalsMap[r.shift_id]) shiftEvalsMap[r.shift_id] = [];
            shiftEvalsMap[r.shift_id].push({
                template_id: r.template_id,
                score_percent: parseFloat(r.score_percent)
            });
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
            // 1. Efficiency Stats (Month Plan + Completed Old Tasks)
            // We count as "Assigned/Plan" for this month:
            // - Tasks originally due this month (AND assigned to user OR completed by user)
            // - Tasks from past months that were COMPLETED by user IN THIS MONTH (cleared backlog)
            const efficiencyRes = await query(
                `SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3) as completed_tasks
                 FROM equipment_maintenance_tasks
                 WHERE 
                    (
                        -- 1. Tasks due this month (Assigned or Completed by user)
                        ((assigned_user_id = $1 OR completed_by = $1) AND due_date >= $2 AND due_date <= $3)
                        OR
                        -- 2. Backlog tasks completed this month by user
                        (completed_by = $1 AND status = 'COMPLETED' AND completed_at >= $2 AND completed_at <= $3 AND due_date < $2)
                    )`,
                [emp.id, startOfMonth, endOfMonth]
            );
            const monthTotalTasks = parseInt(efficiencyRes.rows[0]?.total_tasks || '0');
            const monthCompletedTasks = parseInt(efficiencyRes.rows[0]?.completed_tasks || '0');

            // 2. Completed Tasks for Payment (Accrual) - for distributing to shifts
            const paymentTasksRes = await query(
                `SELECT id, bonus_earned, completed_at
                 FROM equipment_maintenance_tasks
                 WHERE completed_by = $1 AND status = 'COMPLETED'
                   AND completed_at >= $2 AND completed_at <= $3`,
                [emp.id, startOfMonth.toISOString(), endOfMonth.toISOString()]
            );
            const paymentTasks = paymentTasksRes.rows;
            const totalMaintenanceBonus = paymentTasks.reduce((sum: number, t: any) => sum + (parseFloat(t.bonus_earned) || 0), 0);

            const monthBonusRes = await query(
                `SELECT COALESCE(SUM(bonus_amount), 0) as total_monthly_bonus
                 FROM maintenance_monthly_bonuses
                 WHERE club_id = $1 AND user_id = $2 AND year = $3 AND month = $4`,
                [clubId, emp.id, startOfMonth.getFullYear(), startOfMonth.getMonth() + 1]
            );
            const totalMonthlyBonus = parseFloat(monthBonusRes.rows[0]?.total_monthly_bonus || 0);

            // Use frozen scheme if payment was made, otherwise use current employee scheme
            const hasPaidSnapshot = empShifts.some((s: any) => s.salary_snapshot?.paid_at);
            const snapshot = hasPaidSnapshot ? empShifts.find((s: any) => s.salary_snapshot?.paid_at)?.salary_snapshot : null;
            const activeScheme = snapshot || emp;

            // Find Maintenance KPI bonus in employee's scheme
            const schemeBonuses = activeScheme.bonuses || [];
            const maintenanceBonusConfig = schemeBonuses.find((b: any) => b.type === 'maintenance_kpi');

            // Calculate Maintenance Bonus based on Scheme Mode
            let finalMaintenanceBonus = 0;

            if (maintenanceBonusConfig) {
                if (maintenanceBonusConfig.calculation_mode === 'MONTHLY') {
                    // Mode: Monthly Tiers (ignore per-task accrued bonuses)
                    const efficiency = monthTotalTasks > 0 ? (monthCompletedTasks / monthTotalTasks) * 100 : 0;
                    const thresholds = maintenanceBonusConfig.efficiency_thresholds || [];
                    
                    // Sort by threshold desc
                    const sortedTiers = [...thresholds].sort((a: any, b: any) => (b.from_percent || 0) - (a.from_percent || 0));
                    const achievedTier = sortedTiers.find((t: any) => efficiency >= (t.from_percent || 0));
                    
                    if (achievedTier) {
                        finalMaintenanceBonus = parseFloat(achievedTier.amount || '0');
                    }
                } else {
                    // Mode: Per Task (default) - use accrued bonuses from DB
                    // This includes both per-task bonuses and legacy monthly bonuses stored in DB
                    finalMaintenanceBonus = totalMaintenanceBonus + totalMonthlyBonus;
                }
            } else {
                // If maintenance_kpi is NOT in scheme, force 0 even if tasks were completed
                finalMaintenanceBonus = 0;
            }

            monthlyMetrics['maintenance_bonus'] = finalMaintenanceBonus;
            // Also pass efficiency metrics so period bonuses can use them if needed (though unlikely)
            monthlyMetrics['maintenance_tasks_completed'] = monthCompletedTasks;
            monthlyMetrics['maintenance_tasks_assigned'] = monthTotalTasks;

            const shifts_count = finishedShifts.length;
            const planned_shifts = empPlannedShifts?.planned_shifts || 20;

            // 1. Calculate Period Bonuses rewards
            let bonuses_status: any[] = [];
            
            // If we have a frozen result in the snapshot, use it
            if (snapshot?.frozen_bonuses_status) {
                bonuses_status = snapshot.frozen_bonuses_status;
            } else {
                const period_bonuses = activeScheme?.period_bonuses || [];
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

                        const standard_shifts = activeScheme?.standard_monthly_shifts || 15;
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
                                target_value = shifts_count > 0 ? scaledThresholds[0].from : (sorted[0]?.from || 0);
                                current_reward_value = 0;
                                current_reward_type = 'PERCENT';
                            }
                        } else {
                            target_value = mode === 'SHIFT' ? shifts_count * (bonus.target_per_shift || 0) : (bonus.target_per_shift || 0) / (standard_shifts || 1) * shifts_count;
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
            }

            // 2. Process shifts with calculated rewards
            const processedShifts = await Promise.all(empShifts.map(async (s: any) => {
                if (s.salary_snapshot?.paid_at || s.status === 'PAID') {
                    return { ...s, calculated_salary: parseFloat(s.calculated_salary || '0'), breakdown: s.salary_breakdown || {} };
                }

                const reportMetricsForShift: Record<string, number> = {
                    total_revenue: calculateShiftIncome(s),
                    revenue_cash: parseFloat(s.cash_income || 0),
                    revenue_card: parseFloat(s.card_income || 0),
                    bar_purchases: parseFloat(s.bar_purchases || 0)
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

                // Inject maintenance metrics for this shift
                const shiftStart = new Date(s.check_in);
                const shiftEnd = s.check_out ? new Date(s.check_out) : new Date();
                
                const shiftTasks = paymentTasks.filter((t: any) => {
                    const d = new Date(t.completed_at);
                    return d >= shiftStart && (s.check_out ? d <= shiftEnd : true);
                });
                
                const shiftRawSum = shiftTasks.reduce((sum: number, t: any) => sum + (parseFloat(t.bonus_earned) || 0), 0);
                
                reportMetricsForShift['maintenance_raw_sum'] = shiftRawSum;
                reportMetricsForShift['maintenance_tasks_completed'] = monthCompletedTasks;
                reportMetricsForShift['maintenance_tasks_assigned'] = monthTotalTasks;
                reportMetricsForShift['maintenance_month_base'] = monthlyMetrics['maintenance_bonus'] || 0;

                // Pass the scheme WITH calculated bonuses reward levels
                // IMPORTANT: Use activeScheme (frozen if paid) instead of emp
                const schemeWithRewards = { ...activeScheme, period_bonuses: bonuses_status };

                const result = await calculateSalary(
                    { 
                        id: s.id, 
                        total_hours: parseFloat(s.total_hours || 0), 
                        report_data: s.report_data,
                        evaluations: shiftEvalsMap[s.id] || [],
                        bar_purchases: parseFloat(s.bar_purchases || 0)
                    },
                    schemeWithRewards,
                    reportMetricsForShift
                );

                return { ...s, calculated_salary: result.total, breakdown: result.breakdown };
            }));

            // Update feature flags based on processed shifts
            const periodBonuses_local = activeScheme?.period_bonuses || [];
            const bonuses_local = activeScheme?.bonuses || [];
            
            const has_kpi_feature = periodBonuses_local.some((b: any) => !b.payout_type || b.payout_type === 'REAL_MONEY') ||
                                   bonuses_local.some((b: any) => !b.payout_type || b.payout_type === 'REAL_MONEY');

            const has_virtual_balance_feature = periodBonuses_local.some((b: any) => b.payout_type === 'VIRTUAL_BALANCE') ||
                                               bonuses_local.some((b: any) => b.payout_type === 'VIRTUAL_BALANCE') ||
                                               (processedShifts.some((s: any) => s.breakdown?.virtual_balance_total > 0));

            // 3. Totals and final summary data
            // base_salary - только ставка
            const base_salary = processedShifts.reduce((sum: number, s: any) => sum + (s.breakdown?.base || 0), 0);
            
            // shift_bonuses - бонусы, привязанные К СМЕНЕ (кроме периодических и обслуживания)
            const shift_bonuses = processedShifts.reduce((sum: number, s: any) => {
                const bonuses = (s.breakdown?.bonuses || [])
                    .filter((b: any) => (b.type === 'SHIFT_BONUS' || b.type === 'CHECKLIST_BONUS') && b.payout_type !== 'VIRTUAL_BALANCE')
                    .reduce((bSum: number, b: any) => bSum + (b.amount || 0), 0);
                return sum + bonuses;
            }, 0);

            const virtual_shift_bonuses = processedShifts.reduce((sum: number, s: any) => {
                const bonuses = (s.breakdown?.bonuses || [])
                    .filter((b: any) => (b.type === 'SHIFT_BONUS' || b.type === 'CHECKLIST_BONUS') && b.payout_type === 'VIRTUAL_BALANCE')
                    .reduce((bSum: number, b: any) => bSum + (b.amount || 0), 0);
                return sum + bonuses;
            }, 0);

            // Shift bonus breakdown for UI
            const shift_bonuses_breakdown = processedShifts.reduce((acc: any[], s: any) => {
                (s.breakdown?.bonuses || []).forEach((b: any) => {
                    if (b.type === 'SHIFT_BONUS' || b.type === 'CHECKLIST_BONUS' || b.type === 'PROGRESSIVE_BONUS') {
                        const existing = acc.find(item => item.name === b.name && item.payout_type === b.payout_type);
                        if (existing) {
                            existing.amount += b.amount;
                        } else {
                            acc.push({ name: b.name, amount: b.amount, payout_type: b.payout_type, type: b.type });
                        }
                    }
                });
                return acc;
            }, []);

            // Add Maintenance KPI to breakdown
            const maintBonus = monthlyMetrics['maintenance_bonus'] || 0;
            const maintConfig = (activeScheme.bonuses || []).find((b: any) => b.type === 'maintenance_kpi');
            if (maintBonus > 0 && maintConfig) {
                shift_bonuses_breakdown.push({
                    name: maintConfig.name || 'KPI Обслуживание',
                    amount: maintBonus,
                    payout_type: maintConfig.payout_type || 'REAL_MONEY',
                    type: 'MAINTENANCE_BONUS'
                });
            }
            
            const total_paid = parseFloat(empPayment?.total_paid || '0');
            const total_paid_bonus = parseFloat(empPayment?.total_paid_bonus || '0');

            // KPI бонусы (периодические) считаем отдельно
            let kpi_bonus_amount = 0;
            let virtual_kpi_bonus_amount = 0;
            
            for (const bonus of bonuses_status) {
                if (bonus.is_met && bonus.current_reward_value > 0) {
                    let bonusAmount = 0;
                    if (bonus.current_reward_type === 'PERCENT') {
                        bonusAmount = bonus.current_value * (bonus.current_reward_value / 100);
                    } else if (bonus.current_reward_type === 'FIXED') {
                        bonusAmount = bonus.current_reward_value;
                    }

                    // Сохраняем рассчитанную сумму в объект для UI
                    bonus.bonus_amount = bonusAmount;

                    if (bonus.payout_type === 'VIRTUAL_BALANCE') {
                        virtual_kpi_bonus_amount += bonusAmount;
                    } else {
                        kpi_bonus_amount += bonusAmount;
                    }
                }
            }

            // Add Maintenance KPI Bonus to totals
            const maintConfigForPayout = (activeScheme.bonuses || []).find((b: any) => b.type === 'maintenance_kpi');
            let maintenance_status = null;
            
            if (maintConfigForPayout) {
                const completed = monthlyMetrics['maintenance_tasks_completed'] || 0;
                const assigned = monthlyMetrics['maintenance_tasks_assigned'] || 0;
                const bonusAmount = monthlyMetrics['maintenance_bonus'] || 0;
                let efficiency = 100;
                if (assigned > 0) efficiency = (completed / assigned) * 100;

                let current_thresholds: any[] = [];
                // Check for efficiency_thresholds (Maintenance KPI specific)
                if (maintConfigForPayout.efficiency_thresholds && Array.isArray(maintConfigForPayout.efficiency_thresholds)) {
                    current_thresholds = maintConfigForPayout.efficiency_thresholds.map((t: any) => ({
                        from: t.from_percent,
                        amount: t.amount,
                        is_met: efficiency >= t.from_percent
                    }));
                } else if (maintConfigForPayout.use_thresholds && maintConfigForPayout.maintenance_thresholds) {
                    current_thresholds = maintConfigForPayout.maintenance_thresholds.map((t: any) => ({
                        from: t.min_tasks,
                        amount: t.amount,
                        is_met: completed >= t.min_tasks
                    }));
                }

                maintenance_status = {
                    ...maintConfigForPayout,
                    current_value: completed,
                    target_value: assigned,
                    efficiency,
                    bonus_amount: bonusAmount,
                    thresholds: current_thresholds,
                    is_met: bonusAmount > 0
                };

                if (maintConfigForPayout.payout_type === 'VIRTUAL_BALANCE') {
                    virtual_kpi_bonus_amount += bonusAmount;
                } else {
                    kpi_bonus_amount += bonusAmount;
                }
            }

                // Final totals: base + shift bonuses + kpi bonuses
                let final_total_accrued = base_salary + shift_bonuses + kpi_bonus_amount;
                let final_virtual_balance_accrued = virtual_shift_bonuses + virtual_kpi_bonus_amount;

                // Add Monthly Checklist Bonuses to final totals
                const allChecklistConfigs = (activeScheme.bonuses || []).filter((b: any) => b.type === 'checklist');
                const checklist_status: any[] = [];

                for (const bonusConfig of allChecklistConfigs) {
                    const empEval = evalMap[emp.id];
                    const score = empEval?.avg || 0;
                    let bonusAmount = 0;
                    let current_thresholds: any[] = [];

                    if (bonusConfig.use_thresholds && bonusConfig.checklist_thresholds && bonusConfig.checklist_thresholds.length > 0) {
                    // Sort descending: 100, 95, 90, 85, 80...
                    const sortedThresholds = [...bonusConfig.checklist_thresholds].sort((a, b) => (Number(b.min_score) || 0) - (Number(a.min_score) || 0));
                    
                    current_thresholds = sortedThresholds.map(t => ({
                        from: t.min_score,
                        amount: t.amount,
                        is_met: score >= t.min_score
                    }));
                    
                    // Find first threshold that is met (the highest one)
                    const metThreshold = sortedThresholds.find(t => score >= (Number(t.min_score) || 0));
                    if (metThreshold) bonusAmount = Number(metThreshold.amount) || 0;
                } else {
                    if (score >= (bonusConfig.min_score || 0)) bonusAmount = Number(bonusConfig.amount) || 0;
                }

                    let total_earned_this_month = 0;

                    if (bonusConfig.mode === 'MONTH') {
                        // Monthly bonus - use the calculated bonusAmount based on average score
                        total_earned_this_month = bonusAmount;
                        if (total_earned_this_month > 0) {
                            if (bonusConfig.payout_type === 'VIRTUAL_BALANCE') {
                                final_virtual_balance_accrued += total_earned_this_month;
                            } else {
                                final_total_accrued += total_earned_this_month;
                            }
                        }
                    } else {
                        // Shift bonus - it's already in final_total_accrued / final_virtual_balance_accrued via shift_bonuses
                        // But we want to show the total sum in UI block
                        total_earned_this_month = processedShifts.reduce((sum: number, s: any) => {
                            const shiftChecklistBonuses = (s.breakdown?.bonuses || [])
                                .filter((b: any) => b.type === 'CHECKLIST_BONUS' && Number(b.template_id) === Number(bonusConfig.checklist_template_id));
                            const shiftSum = shiftChecklistBonuses.reduce((bSum: number, b: any) => bSum + (b.amount || 0), 0);
                            return sum + shiftSum;
                        }, 0);
                    }

                    checklist_status.push({
                        ...bonusConfig,
                        current_value: score,
                        bonus_amount: total_earned_this_month,
                        thresholds: current_thresholds,
                        is_met: total_earned_this_month > 0
                    });
                }

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
                planned_shifts,
                base_salary,
                total_accrued: final_total_accrued,
                kpi_bonus_amount: final_total_accrued - base_salary,
                virtual_balance_accrued: final_virtual_balance_accrued,
                total_paid,
                balance: final_total_accrued - total_paid,
                virtual_balance: final_virtual_balance_accrued - total_paid_bonus,
                total_paid_bonus,
                period_bonuses: bonuses_status,
                checklist_bonuses: checklist_status,
                maintenance_status,
                shift_bonuses_breakdown,
                has_kpi_feature,
                has_virtual_balance_feature,
                // New detailed data
                breakdown: {
                    base_salary,
                    virtual_balance: final_virtual_balance_accrued,
                    kpi_bonuses: kpi_bonus_amount,
                    other_bonuses: shift_bonuses
                },
                metrics: {
                    total_revenue,
                    avg_revenue_per_shift: shifts_count > 0 ? total_revenue / finishedShifts.length : 0,
                    total_hours,
                    avg_hours_per_shift: shifts_count > 0 ? total_hours / finishedShifts.length : 0,
                    revenue_by_metric,
                    // Explicitly pass maintenance metrics
                    maintenance_bonus: monthlyMetrics['maintenance_bonus'] || 0,
                    maintenance_tasks_completed: monthlyMetrics['maintenance_tasks_completed'] || 0,
                    maintenance_tasks_assigned: monthlyMetrics['maintenance_tasks_assigned'] || 0,
                    // Explicitly pass evaluation metrics
                    evaluation_score: monthlyMetrics['evaluation_score'] || 0,
                    evaluation_count: monthlyMetrics['evaluation_count'] || 0
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
                        
                        // Разделяем бонусы по типам выплат
                        const realMoneyBonuses = breakdown.bonuses?.filter((b: any) => b.payout_type !== 'VIRTUAL_BALANCE') || [];
                        const virtualBonuses = breakdown.bonuses?.filter((b: any) => b.payout_type === 'VIRTUAL_BALANCE') || [];

                        return {
                            id: s.id,
                            date: s.check_in,
                            total_hours: parseFloat(s.total_hours || '0'),
                            total_revenue: calculateShiftIncome(s),
                            calculated_salary: s.calculated_salary,  // Только REAL_MONEY
                            virtual_balance_earned: breakdown.virtual_balance_total || 0,  // VIRTUAL_BALANCE
                            kpi_bonus: kpiBonus,
                            status: s.status,
                            is_paid: !!(s.salary_snapshot?.paid_at),
                            type: s.salary_snapshot?.type || 'REGULAR',
                            metrics: typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data || {},
                            bonuses: breakdown.bonuses || [],
                            real_money_bonuses: realMoneyBonuses,
                            virtual_bonuses: virtualBonuses
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
