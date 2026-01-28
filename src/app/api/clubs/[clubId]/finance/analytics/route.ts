import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

// GET /api/clubs/[clubId]/finance/analytics
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const user = await getUserFromToken(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;
        const { searchParams } = new URL(request.url);

        const period = searchParams.get('period') || 'month'; // 'month', 'quarter', 'year'
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        // Determine date range
        let dateCondition = '';
        const values: any[] = [clubId];

        if (startDate && endDate) {
            dateCondition = `AND transaction_date BETWEEN $2 AND $3`;
            values.push(startDate, endDate);
        } else {
            // Default to current month
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dateCondition = `AND transaction_date BETWEEN $2 AND $3`;
            values.push(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]);
        }

        // 1. INCOME AND EXPENSES SUMMARY
        const summaryResult = await pool.query(
            `SELECT 
                SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as total_expense,
                COUNT(CASE WHEN type = 'income' AND status = 'completed' THEN 1 END) as income_count,
                COUNT(CASE WHEN type = 'expense' AND status = 'completed' THEN 1 END) as expense_count
            FROM finance_transactions
            WHERE club_id = $1 ${dateCondition}`,
            values
        );

        const summary = summaryResult.rows[0];
        const totalIncome = parseFloat(summary.total_income || 0);
        const totalExpense = parseFloat(summary.total_expense || 0);
        const profit = totalIncome - totalExpense;
        const profitability = totalIncome > 0 ? ((profit / totalIncome) * 100) : 0;

        // 2. BREAKDOWN BY CATEGORY
        const categoryBreakdown = await pool.query(
            `SELECT 
                fc.id,
                fc.name,
                fc.type,
                fc.icon,
                fc.color,
                SUM(ft.amount) as total_amount,
                COUNT(ft.id) as transaction_count,
                ROUND((SUM(ft.amount) / NULLIF(
                    (SELECT SUM(amount) FROM finance_transactions 
                     WHERE club_id = $1 ${dateCondition} AND type = fc.type AND status = 'completed'), 
                    0
                ) * 100), 2) as percentage
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 ${dateCondition} AND ft.status = 'completed'
            GROUP BY fc.id, fc.name, fc.type, fc.icon, fc.color
            ORDER BY total_amount DESC`,
            values
        );

        // 3. MONTHLY TREND (last 6 months)
        const monthlyTrend = await pool.query(
            `SELECT 
                DATE_TRUNC('month', transaction_date) as month,
                SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as expense
            FROM finance_transactions
            WHERE club_id = $1 
                AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
                AND status = 'completed'
            GROUP BY DATE_TRUNC('month', transaction_date)
            ORDER BY month ASC`,
            [clubId]
        );

        const trend = monthlyTrend.rows.map(row => ({
            month: row.month,
            income: parseFloat(row.income || 0),
            expense: parseFloat(row.expense || 0),
            profit: parseFloat(row.income || 0) - parseFloat(row.expense || 0)
        }));

        // 4. CASH FLOW FORECAST (upcoming 30/60/90 days)
        const upcomingPayments = await pool.query(
            `SELECT 
                CASE 
                    WHEN transaction_date <= CURRENT_DATE + INTERVAL '30 days' THEN '30_days'
                    WHEN transaction_date <= CURRENT_DATE + INTERVAL '60 days' THEN '60_days'
                    ELSE '90_days'
                END as period,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as planned_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as planned_expense
            FROM finance_transactions
            WHERE club_id = $1 
                AND status IN ('planned', 'pending')
                AND transaction_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
            GROUP BY period`,
            [clubId]
        );

        const forecast = {
            30: { income: 0, expense: 0, net: 0 },
            60: { income: 0, expense: 0, net: 0 },
            90: { income: 0, expense: 0, net: 0 }
        };

        upcomingPayments.rows.forEach(row => {
            const days = row.period === '30_days' ? 30 : row.period === '60_days' ? 60 : 90;
            forecast[days as keyof typeof forecast] = {
                income: parseFloat(row.planned_income || 0),
                expense: parseFloat(row.planned_expense || 0),
                net: parseFloat(row.planned_income || 0) - parseFloat(row.planned_expense || 0)
            };
        });

        // 5. TOP EXPENSES
        const topExpenses = await pool.query(
            `SELECT 
                fc.name as category_name,
                fc.icon,
                SUM(ft.amount) as total_amount,
                COUNT(ft.id) as transaction_count
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 ${dateCondition}
                AND ft.type = 'expense'
                AND ft.status = 'completed'
            GROUP BY fc.id, fc.name, fc.icon
            ORDER BY total_amount DESC
            LIMIT 5`,
            values
        );

        // 6. BREAK-EVEN POINT (minimum revenue to cover expenses)
        // Calculate fixed monthly expenses
        const fixedExpenses = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total_fixed
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 
                AND ft.type = 'expense'
                AND ft.status = 'completed'
                AND fc.name IN ('Аренда помещения', 'Коммунальные услуги', 'Зарплата сотрудников')
                ${dateCondition}`,
            values
        );

        const breakEvenPoint = parseFloat(fixedExpenses.rows[0].total_fixed || 0);

        // 7. UPCOMING PAYMENTS (next 7 days)
        const upcomingResult = await pool.query(
            `SELECT 
                ft.id,
                ft.amount,
                ft.type,
                ft.transaction_date,
                ft.description,
                fc.name as category_name,
                fc.icon
            FROM finance_transactions ft
            JOIN finance_categories fc ON ft.category_id = fc.id
            WHERE ft.club_id = $1 
                AND ft.status IN ('planned', 'pending')
                AND ft.transaction_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            ORDER BY ft.transaction_date ASC
            LIMIT 10`,
            [clubId]
        );

        return NextResponse.json({
            summary: {
                total_income: totalIncome,
                total_expense: totalExpense,
                profit,
                profitability: Math.round(profitability * 100) / 100,
                income_count: parseInt(summary.income_count || 0),
                expense_count: parseInt(summary.expense_count || 0)
            },
            category_breakdown: {
                income: categoryBreakdown.rows.filter(r => r.type === 'income').map(r => ({
                    ...r,
                    total_amount: parseFloat(r.total_amount),
                    percentage: parseFloat(r.percentage || 0)
                })),
                expense: categoryBreakdown.rows.filter(r => r.type === 'expense').map(r => ({
                    ...r,
                    total_amount: parseFloat(r.total_amount),
                    percentage: parseFloat(r.percentage || 0)
                }))
            },
            monthly_trend: trend,
            cash_flow_forecast: forecast,
            top_expenses: topExpenses.rows.map(r => ({
                ...r,
                total_amount: parseFloat(r.total_amount)
            })),
            break_even_point: breakEvenPoint,
            upcoming_payments: upcomingResult.rows.map(r => ({
                ...r,
                amount: parseFloat(r.amount)
            }))
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
