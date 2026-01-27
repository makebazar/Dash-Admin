import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // Verify employee belongs to club
        const employeeCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if (employeeCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get current month/year
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
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

        // 2. Get hourly rate and scheme for KPI
        const schemeRes = await query(
            `SELECT ss.*, (r.default_kpi_settings->>'base_rate')::numeric as role_rate
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN employee_salary_assignments esa ON u.id = esa.user_id AND esa.club_id = $2
             LEFT JOIN salary_schemes ss ON ss.id = esa.scheme_id
             WHERE u.id = $1
             ORDER BY esa.assigned_at DESC LIMIT 1`,
            [userId, clubId]
        );

        const scheme = schemeRes.rows[0];
        const hourlyRate = parseFloat(scheme?.role_rate || '150');
        const period_bonuses = scheme?.period_bonuses || [];
        const standard_monthly_shifts = scheme?.standard_monthly_shifts || 15;

        // 3. Get shifts data
        const shiftsRes = await query(
            `SELECT 
                id, cash_income, card_income, total_hours, report_data, calculated_salary, check_in
             FROM shifts
             WHERE user_id = $1 AND club_id = $2
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED', 'ACTIVE')`,
            [userId, clubId, startOfMonth, endOfMonth]
        );

        const finishedShifts = shiftsRes.rows;
        const shifts_count = finishedShifts.length;

        let totalCalculatedSalary = 0;
        let totalHours = 0;
        let todayHours = 0;
        let weekHours = 0;
        const monthlyMetrics: Record<string, number> = { total_revenue: 0, total_hours: 0 };

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        finishedShifts.forEach(s => {
            const hours = parseFloat(s.total_hours || 0);
            totalHours += hours;
            totalCalculatedSalary += parseFloat(s.calculated_salary || 0);

            const shiftDate = new Date(s.check_in);
            if (shiftDate.toDateString() === now.toDateString()) {
                todayHours += hours;
            }
            if (shiftDate >= startOfWeek) {
                weekHours += hours;
            }

            // Metric tracking for KPI
            let shiftIncome = 0;
            if (metricCategories['cash_income'] === 'INCOME' || !metricCategories['cash_income']) shiftIncome += parseFloat(s.cash_income || 0);
            if (metricCategories['card_income'] === 'INCOME' || !metricCategories['card_income']) shiftIncome += parseFloat(s.card_income || 0);

            if (s.report_data) {
                const data = typeof s.report_data === 'string' ? JSON.parse(s.report_data) : s.report_data;
                Object.keys(data).forEach(key => {
                    const val = parseFloat(data[key] || 0);
                    if (metricCategories[key] === 'INCOME' && key !== 'cash_income' && key !== 'card_income') {
                        shiftIncome += val;
                    }
                    monthlyMetrics[key] = (monthlyMetrics[key] || 0) + val;
                });
            }
            monthlyMetrics.total_revenue += shiftIncome;
        });

        // 4. Calculate KPI Bonus (Period Bonus)
        let totalKpiBonus = 0;
        if (Array.isArray(period_bonuses)) {
            period_bonuses.forEach((bonus: any) => {
                const metric_key = bonus.metric_key || 'total_revenue';
                const current_value = monthlyMetrics[metric_key] ||
                    (metric_key === 'total_revenue' ? monthlyMetrics.total_revenue : 0);

                if (bonus.type === 'PROGRESSIVE' && bonus.thresholds?.length) {
                    const sorted = [...bonus.thresholds].sort((a: any, b: any) => (a.from || 0) - (b.from || 0));
                    const mode = bonus.bonus_mode || 'MONTH';

                    let metPercent = 0;
                    for (let i = sorted.length - 1; i >= 0; i--) {
                        const scaled_threshold = mode === 'SHIFT'
                            ? sorted[i].from * shifts_count
                            : (sorted[i].from / standard_monthly_shifts) * shifts_count;

                        if (shifts_count > 0 && current_value >= scaled_threshold) {
                            metPercent = sorted[i].percent;
                            break;
                        }
                    }
                    if (metPercent > 0) {
                        totalKpiBonus += current_value * (metPercent / 100);
                    }
                }
            });
        }

        const monthEarnings = totalCalculatedSalary + totalKpiBonus;

        return NextResponse.json({
            today_hours: todayHours,
            week_hours: weekHours,
            week_earnings: weekHours * hourlyRate, // Week info is usually estimate
            month_earnings: monthEarnings,
            hourly_rate: hourlyRate,
            kpi_bonus: totalKpiBonus
        });

    } catch (error) {
        console.error('Get Employee Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
