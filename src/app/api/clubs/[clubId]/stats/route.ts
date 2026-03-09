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

        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const statsResult = await query(
            `SELECT 
                COALESCE(SUM(COALESCE(cash_income, 0) + COALESCE(card_income, 0)), 0) as total_revenue,
                COALESCE(SUM(COALESCE(expenses, 0)), 0) as total_expenses,
                COALESCE(SUM(COALESCE(cash_income, 0) + COALESCE(card_income, 0) - COALESCE(expenses, 0)), 0) as actual_balance
             FROM shifts s
             LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
             WHERE COALESCE(s.club_id, sr.club_id) = $1
               AND s.status NOT IN ('ACTIVE', 'CANCELLED')
               AND COALESCE(s.check_out, s.check_in) >= DATE_TRUNC('month', CURRENT_DATE)`,
            [clubId]
        );

        const prevStatsResult = await query(
            `SELECT 
                COALESCE(SUM(COALESCE(cash_income, 0) + COALESCE(card_income, 0)), 0) as total_revenue,
                COALESCE(SUM(COALESCE(expenses, 0)), 0) as total_expenses
             FROM shifts s
             LEFT JOIN shift_reports sr ON s.shift_report_id = sr.id
             WHERE COALESCE(s.club_id, sr.club_id) = $1
               AND s.status NOT IN ('ACTIVE', 'CANCELLED')
               AND COALESCE(s.check_out, s.check_in) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
               AND COALESCE(s.check_out, s.check_in) < DATE_TRUNC('month', CURRENT_DATE)`,
            [clubId]
        );

        const current = statsResult.rows[0];
        const previous = prevStatsResult.rows[0];

        const revenueChange = previous.total_revenue > 0
            ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue * 100).toFixed(1)
            : '0';

        const expensesChange = previous.total_expenses > 0
            ? ((current.total_expenses - previous.total_expenses) / previous.total_expenses * 100).toFixed(1)
            : '0';

        const profit = Number(current.total_revenue) - Number(current.total_expenses);
        const prevProfit = Number(previous.total_revenue) - Number(previous.total_expenses);
        const profitChange = prevProfit > 0
            ? ((profit - prevProfit) / prevProfit * 100).toFixed(1)
            : '0';

        return NextResponse.json({
            revenue: {
                total: Number(current.total_revenue),
                change: parseFloat(revenueChange)
            },
            expenses: {
                total: Number(current.total_expenses),
                change: parseFloat(expensesChange)
            },
            balance: {
                actual: Number(current.actual_balance)
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
