import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { requireClubApiAccess } from '@/lib/club-api-access';

// POST /api/clubs/[clubId]/finance/accounts/adjust
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const userId = await requireClubApiAccess(clubId)
        const body = await request.json();
        const { account_id, new_balance, reason } = body;

        if (!account_id || new_balance === undefined) {
            return NextResponse.json({ error: 'Account ID and new balance are required' }, { status: 400 });
        }

        // 1. Get current balance
        const accountRes = await query(
            `SELECT current_balance, name FROM finance_accounts WHERE id = $1 AND club_id = $2`,
            [account_id, clubId]
        );

        if (accountRes.rows.length === 0) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const currentBalance = parseFloat(accountRes.rows[0].current_balance);
        const diff = parseFloat(new_balance) - currentBalance;

        if (Math.abs(diff) < 0.01) {
            return NextResponse.json({ success: true, message: 'No adjustment needed' });
        }

        // 2. Get system category
        const categoryRes = await query(
            `SELECT id FROM finance_categories 
             WHERE name = 'Ввод начальных остатков / Корректировка' 
             AND is_system = true LIMIT 1`
        );

        if (categoryRes.rows.length === 0) {
            return NextResponse.json({ error: 'System adjustment category not found' }, { status: 500 });
        }

        const categoryId = categoryRes.rows[0].id;

        // 3. Create adjustment transaction
        // Trigger trg_update_account_balance will handle the actual account balance update
        await query(
            `INSERT INTO finance_transactions (
                club_id, category_id, amount, type, payment_method,
                account_id, transaction_date, description, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, 'completed', $8)`,
            [
                clubId,
                categoryId,
                Math.abs(diff),
                diff > 0 ? 'income' : 'expense',
                'other',
                account_id,
                reason || 'Корректировка баланса (ручной ввод)',
                userId
            ]
        );

        return NextResponse.json({ 
            success: true, 
            diff, 
            old_balance: currentBalance, 
            new_balance: parseFloat(new_balance) 
        });

    } catch (error) {
        const status = (error as { status?: number })?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status })
        }
        console.error('Error adjusting account balance:', error);
        return NextResponse.json({ error: 'Failed to adjust balance' }, { status: 500 });
    }
}
