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

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const prevStart = new Date(year, month - 2, 1);
        const prevEnd = new Date(year, month - 1, 0, 23, 59, 59);

        // 1. Fetch employee's salary scheme and info
        const employeeRes = await query(
            `SELECT 
                u.id, 
                u.full_name,
                s.period_bonuses,
                s.standard_monthly_shifts,
                v.formula as scheme_formula
             FROM club_employees ce
             JOIN users u ON ce.user_id = u.id
             LEFT JOIN employee_salary_assignments esa ON u.id = esa.user_id
             LEFT JOIN salary_schemes s ON esa.scheme_id = s.id
             LEFT JOIN LATERAL (
                 SELECT formula 
                 FROM salary_scheme_versions 
                 WHERE scheme_id = s.id 
                 ORDER BY version DESC 
                 LIMIT 1
             ) v ON true
             WHERE ce.club_id = $1 AND u.id = $2`,
            [clubId, userId]
        );

        if (employeeRes.rowCount === 0) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const row = employeeRes.rows[0];
        const formula = row.scheme_formula || {};
        const employeeScheme = {
            ...row,
            ...formula,
            period_bonuses: row.period_bonuses || formula.period_bonuses,
            standard_monthly_shifts: row.standard_monthly_shifts || formula.standard_monthly_shifts || 15
        };

        // 2. Fetch report template for category mapping
        const templateRes = await query(
            `SELECT schema FROM club_report_templates 
             WHERE club_id = $1 AND is_active = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [clubId]
        );
        const templateSchema = templateRes.rows[0]?.schema || [];
        const fields = Array.isArray(templateSchema) ? templateSchema : (templateSchema.fields || []);

        const metricCategories: Record<string, string> = {};
        fields.forEach((f: any) => {
            const key = f.metric_key || f.key;
            if (key) {
                let cat = f.field_type || f.calculation_category;
                if (!cat) {
                    if (key.includes('income') || key.includes('revenue') || key === 'cash' || key === 'card') cat = 'INCOME';
                    else if (key.includes('expense')) cat = 'EXPENSE';
                    else cat = 'OTHER';
                }
                metricCategories[key] = cat;
            }
        });

        const calculateShiftRevenue = (s: any) => {
            let rev = 0;
            if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) rev += parseFloat(s.cash_income || 0);
            if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) rev += parseFloat(s.card_income || 0);

            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                        rev += parseFloat(data[key] || 0);
                    }
                });
            }
            return rev;
        };

        const calculateShiftExpenses = (s: any) => {
            let exp = 0;
            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    if (metricCategories[key] === 'EXPENSE') {
                        exp += parseFloat(data[key] || 0);
                    }
                });
            }
            return exp;
        }

        // 3. Fetch shifts for current period
        const currentShiftsRaw = await query(
            `SELECT 
                id, check_in, check_out, total_hours, calculated_salary as earnings, 
                status, shift_type, cash_income, card_income, report_data, salary_breakdown
             FROM shifts
             WHERE user_id = $1 AND club_id = $2 
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')
             ORDER BY check_in DESC`,
            [userId, clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );

        // 4. Calculate monthly metrics for KPI scaling
        const finishedShifts = currentShiftsRaw.rows.filter(s => s.status !== 'ACTIVE');
        const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };
        finishedShifts.forEach(s => {
            monthlyMetrics.total_revenue += calculateShiftRevenue(s);
            monthlyMetrics.total_hours += parseFloat(s.total_hours || 0);
            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    monthlyMetrics[key] = (monthlyMetrics[key] || 0) + parseFloat(data[key] || 0);
                });
            }
        });

        // 5. Scale KPI Thresholds and determine met levels
        const shiftsCount = finishedShifts.length;
        const standardShifts = employeeScheme.standard_monthly_shifts;

        let bonusesStatus: any[] = [];
        if (Array.isArray(employeeScheme.period_bonuses)) {
            bonusesStatus = employeeScheme.period_bonuses.map((bonus: any) => {
                const currentValue = monthlyMetrics[bonus.metric_key] ||
                    (bonus.metric_key === 'total_revenue' ? monthlyMetrics.total_revenue :
                        bonus.metric_key === 'total_hours' ? monthlyMetrics.total_hours : 0);

                let isMet = false;
                let currentRewardValue = bonus.reward_value;
                let currentRewardType = bonus.reward_type;
                const mode = bonus.bonus_mode || 'MONTH';

                if (bonus.type === 'PROGRESSIVE' && Array.isArray(bonus.thresholds)) {
                    const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));
                    const scaledThresholds = sorted.map((t: any) => {
                        const threshold_from = t.from || 0;
                        let scaled_from = mode === 'SHIFT' ? threshold_from * shiftsCount : (threshold_from / standardShifts) * shiftsCount;
                        return { from: scaled_from, percent: t.percent || 0 };
                    });

                    let metThresholdIndex = -1;
                    for (let i = scaledThresholds.length - 1; i >= 0; i--) {
                        if (currentValue >= scaledThresholds[i].from) { metThresholdIndex = i; break; }
                    }

                    if (metThresholdIndex >= 0 && shiftsCount > 0) {
                        isMet = true;
                        currentRewardValue = scaledThresholds[metThresholdIndex].percent;
                        currentRewardType = 'PERCENT';
                    }
                } else {
                    const target = mode === 'SHIFT' ? shiftsCount * (bonus.target_per_shift || 0) : (bonus.target_per_shift || 0) / standardShifts * shiftsCount;
                    isMet = shiftsCount > 0 && currentValue >= target;
                }

                return { ...bonus, current_reward_value: currentRewardValue, current_reward_type: currentRewardType, is_met: isMet };
            });
        }

        // 6. Recalculate each shift salary with KPI contributions
        const processedShifts = await Promise.all(currentShiftsRaw.rows.map(async (s: any) => {
            const reportMetricsForShift: Record<string, number> = {
                total_revenue: calculateShiftRevenue(s),
                revenue_cash: parseFloat(s.cash_income || 0),
                revenue_card: parseFloat(s.card_income || 0)
            };
            const rData = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data || {};
            Object.keys(rData).forEach(key => { reportMetricsForShift[key] = parseFloat(rData[key] || 0); });

            const schemeWithRewards = { ...employeeScheme, period_bonuses: bonusesStatus };
            const calc = await calculateSalary(
                { id: s.id, total_hours: parseFloat(s.total_hours || 0), report_data: s.report_data },
                schemeWithRewards,
                reportMetricsForShift
            );

            const kpiBonus = (calc.breakdown.bonuses || [])
                .filter((b: any) => b.type === 'PERIOD_BONUS_CONTRIBUTION' || b.type === 'SHIFT_BONUS')
                .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);

            return {
                ...s,
                employee_name: employeeScheme.full_name,
                total_revenue: reportMetricsForShift.total_revenue,
                total_expenses: calculateShiftExpenses(s),
                earnings: calc.total,
                kpi_bonus: kpiBonus,
                salary_breakdown: calc.breakdown,
                report_data: rData
            };
        }));

        // 7. Calculate summary based on recalculated values
        const prevRes = await query(
            `SELECT total_hours, calculated_salary as earnings, cash_income, card_income, report_data
             FROM shifts
             WHERE user_id = $1 AND club_id = $2 
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED')`,
            [userId, clubId, prevStart.toISOString(), prevEnd.toISOString()]
        );

        const currentStats = processedShifts.filter(s => s.status !== 'ACTIVE').reduce((acc, s) => {
            acc.earnings += s.earnings;
            acc.hours += parseFloat(s.total_hours || 0);
            acc.revenue += s.total_revenue;
            return acc;
        }, { earnings: 0, hours: 0, revenue: 0 });

        const prevStats = prevRes.rows.reduce((acc, s) => {
            acc.earnings += parseFloat(s.earnings || 0);
            acc.hours += parseFloat(s.total_hours || 0);
            acc.revenue += calculateShiftRevenue(s);
            return acc;
        }, { earnings: 0, hours: 0, revenue: 0 });

        const compare = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        const summary = {
            earnings: { value: currentStats.earnings, diff: compare(currentStats.earnings, prevStats.earnings) },
            hours: { value: currentStats.hours, diff: compare(currentStats.hours, prevStats.hours) },
            revenue: { value: currentStats.revenue, diff: compare(currentStats.revenue, prevStats.revenue) },
            shifts_count: { value: currentShiftsRaw.rowCount, diff: compare(currentShiftsRaw.rowCount || 0, prevRes.rowCount || 0) }
        };

        // Prepare metadata for frontend
        const metricMetadata: Record<string, any> = {};
        fields.forEach((f: any) => {
            const key = f.metric_key || f.key;
            if (key) {
                metricMetadata[key] = {
                    label: f.label || f.name || key,
                    category: metricCategories[key]
                };
            }
        });

        return NextResponse.json({
            shifts: processedShifts,
            summary,
            template_fields: fields,
            metric_metadata: metricMetadata
        });

    } catch (error: any) {
        console.error('Shift History Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
