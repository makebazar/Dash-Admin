import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { getClubIncomeMetrics, getShiftExpenses, getShiftIncomeBreakdown } from '@/lib/assistant/income-metrics';

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

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { metrics: incomeMetrics } = await getClubIncomeMetrics(clubId);

        const statsResult = await query(
            `SELECT cash_income, card_income, expenses, report_data
             FROM shifts s
             LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
             WHERE COALESCE(s.club_id, sr.club_id) = $1
               AND s.status NOT IN ('ACTIVE', 'CANCELLED')
               AND COALESCE(s.check_out, s.check_in) >= DATE_TRUNC('month', CURRENT_DATE)`,
            [clubId]
        );

        const prevStatsResult = await query(
            `SELECT cash_income, card_income, expenses, report_data
             FROM shifts s
             LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
             WHERE COALESCE(s.club_id, sr.club_id) = $1
               AND s.status NOT IN ('ACTIVE', 'CANCELLED')
               AND COALESCE(s.check_out, s.check_in) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
               AND COALESCE(s.check_out, s.check_in) < DATE_TRUNC('month', CURRENT_DATE)`,
            [clubId]
        );

        const currentRevenue = statsResult.rows.reduce((acc: number, s: any) => acc + getShiftIncomeBreakdown(s, incomeMetrics).total, 0);
        const currentExpenses = statsResult.rows.reduce((acc: number, s: any) => acc + getShiftExpenses(s), 0);
        const previousRevenue = prevStatsResult.rows.reduce((acc: number, s: any) => acc + getShiftIncomeBreakdown(s, incomeMetrics).total, 0);
        const previousExpenses = prevStatsResult.rows.reduce((acc: number, s: any) => acc + getShiftExpenses(s), 0);

        const revenueChange = previousRevenue > 0
            ? ((currentRevenue - previousRevenue) / previousRevenue * 100).toFixed(1)
            : '0';

        const expensesChange = previousExpenses > 0
            ? ((currentExpenses - previousExpenses) / previousExpenses * 100).toFixed(1)
            : '0';

        const profit = Number(currentRevenue) - Number(currentExpenses);
        const prevProfit = Number(previousRevenue) - Number(previousExpenses);
        const profitChange = prevProfit > 0
            ? ((profit - prevProfit) / prevProfit * 100).toFixed(1)
            : '0';

        return NextResponse.json({
            revenue: {
                total: Number(currentRevenue),
                change: parseFloat(revenueChange)
            },
            expenses: {
                total: Number(currentExpenses),
                change: parseFloat(expensesChange)
            },
            balance: {
                actual: Number(currentRevenue) - Number(currentExpenses)
            },
            profit: {
                total: profit,
                change: parseFloat(profitChange)
            }
        });

    } catch (error) {
        console.error('Get Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
