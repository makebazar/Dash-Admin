import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET /api/clubs/[clubId]/finance/accounts/balance
// Returns summary of all account balances and total
export async function GET(
    request: NextRequest,
    { params }: { params: { clubId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId } = params;

        // Get balances grouped by account type
        const result = await query(
            `SELECT 
                account_type,
                SUM(current_balance) as total_balance,
                COUNT(*) as account_count,
                json_agg(
                    json_build_object(
                        'id', id,
                        'name', name,
                        'balance', current_balance,
                        'icon', icon,
                        'color', color
                    ) ORDER BY name
                ) as accounts
             FROM finance_accounts
             WHERE club_id = $1 AND is_active = TRUE
             GROUP BY account_type
             ORDER BY 
                CASE account_type
                    WHEN 'cash' THEN 1
                    WHEN 'bank' THEN 2
                    WHEN 'card' THEN 3
                    ELSE 4
                END`,
            [clubId]
        );

        const balances = result.rows.map(row => ({
            account_type: row.account_type,
            total_balance: parseFloat(row.total_balance),
            account_count: parseInt(row.account_count),
            accounts: row.accounts.map((acc: any) => ({
                ...acc,
                balance: parseFloat(acc.balance)
            }))
        }));

        // Calculate grand total
        const grandTotal = balances.reduce((sum, item) => sum + item.total_balance, 0);

        return NextResponse.json({
            balances,
            total: grandTotal
        });
    } catch (error) {
        console.error('Error fetching account balances:', error);
        return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
    }
}
