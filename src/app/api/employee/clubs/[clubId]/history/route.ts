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

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        const prevStart = new Date(year, month - 2, 1);
        const prevEnd = new Date(year, month - 1, 0, 23, 59, 59);

        // Fetch report template for category mapping
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

        // Fetch shifts for current period
        const currentShifts = await query(
            `SELECT 
                id, check_in, check_out, total_hours, calculated_salary as earnings, 
                status, shift_type, cash_income, card_income, report_data, salary_breakdown
             FROM shifts
             WHERE user_id = $1 AND club_id = $2 
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED')
             ORDER BY check_in DESC`,
            [userId, clubId, startOfMonth.toISOString(), endOfMonth.toISOString()]
        );

        // Fetch shifts for previous period for comparison
        const prevShifts = await query(
            `SELECT total_hours, calculated_salary as earnings, cash_income, card_income, report_data
             FROM shifts
             WHERE user_id = $1 AND club_id = $2 
               AND check_in >= $3 AND check_in <= $4
               AND status IN ('CLOSED', 'PAID', 'VERIFIED')`,
            [userId, clubId, prevStart.toISOString(), prevEnd.toISOString()]
        );

        const calculateStats = (shifts: any[]) => {
            return shifts.reduce((acc, s) => {
                acc.earnings += parseFloat(s.earnings || 0);
                acc.hours += parseFloat(s.total_hours || 0);
                acc.revenue += calculateShiftRevenue(s);
                return acc;
            }, { earnings: 0, hours: 0, revenue: 0 });
        };

        const currentStats = calculateStats(currentShifts.rows);
        const prevStats = calculateStats(prevShifts.rows);

        const compare = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        const summary = {
            earnings: { value: currentStats.earnings, diff: compare(currentStats.earnings, prevStats.earnings) },
            hours: { value: currentStats.hours, diff: compare(currentStats.hours, prevStats.hours) },
            revenue: { value: currentStats.revenue, diff: compare(currentStats.revenue, prevStats.revenue) },
            shifts_count: { value: currentShifts.rowCount, diff: compare(currentShifts.rowCount || 0, prevShifts.rowCount || 0) }
        };

        return NextResponse.json({
            shifts: currentShifts.rows.map(s => ({
                ...s,
                total_revenue: calculateShiftRevenue(s),
                kpi_bonus: (s.salary_breakdown?.bonuses || [])
                    .filter((b: any) => b.type === 'PERIOD_BONUS_CONTRIBUTION' || b.type === 'SHIFT_BONUS')
                    .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0)
            })),
            summary
        });

    } catch (error: any) {
        console.error('Shift History Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
