import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET: Get employee balance and transaction history
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employee_id');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!employeeId) {
            return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
        }

        // Get balance
        const balanceResult = await query(
            `SELECT * FROM employee_balances 
             WHERE club_id = $1 AND user_id = $2`,
            [clubId, employeeId]
        );

        const balance = balanceResult.rows[0] || { balance: 0, currency: 'RUB' };

        // Get transaction history
        const transactionsResult = await query(
            `SELECT 
                t.*,
                u.full_name as created_by_name
             FROM employee_balance_transactions t
             LEFT JOIN users u ON t.created_by = u.id
             WHERE t.club_id = $1 AND t.user_id = $2
             ORDER BY t.created_at DESC
             LIMIT 100`,
            [clubId, employeeId]
        );

        return NextResponse.json({
            balance,
            transactions: transactionsResult.rows
        });

    } catch (error: any) {
        console.error('Get Employee Balance Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create balance transaction (accrue or write off)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const {
            employee_id,
            amount,
            transaction_type,
            description,
            payout_type = 'VIRTUAL_BALANCE',
            bonus_type,
            shift_id,
            reference_type,
            reference_id
        } = body;

        if (!employee_id || !amount) {
            return NextResponse.json({ 
                error: 'employee_id and amount are required' 
            }, { status: 400 });
        }

        const client = await (await import('@/db')).queryClient();
        
        try {
            await client.query('BEGIN');

            // Get or create balance
            const balanceCheck = await client.query(
                `SELECT * FROM employee_balances 
                 WHERE club_id = $1 AND user_id = $2`,
                [clubId, employee_id]
            );

            let currentBalance = 0;
            if (balanceCheck.rows.length > 0) {
                currentBalance = parseFloat(balanceCheck.rows[0].balance) || 0;
            } else {
                // Create new balance record
                await client.query(
                    `INSERT INTO employee_balances (club_id, user_id, balance, currency)
                     VALUES ($1, $2, $3, 'RUB')`,
                    [clubId, employee_id, 0]
                );
            }

            // Validate sufficient balance for write-off
            const transactionAmount = parseFloat(amount);
            if (transactionAmount < 0 && currentBalance + transactionAmount < 0) {
                await client.query('ROLLBACK');
                return NextResponse.json({ 
                    error: 'Insufficient balance' 
                }, { status: 400 });
            }

            // Create transaction
            const transactionResult = await client.query(
                `INSERT INTO employee_balance_transactions (
                    club_id, user_id, amount, transaction_type, description,
                    payout_type, bonus_type, shift_id, reference_type, reference_id, created_by
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [
                    clubId,
                    employee_id,
                    transactionAmount,
                    transaction_type || 'BONUS',
                    description || '',
                    payout_type,
                    bonus_type || null,
                    shift_id || null,
                    reference_type || null,
                    reference_id || null,
                    userId
                ]
            );

            // Update balance
            const newBalance = currentBalance + transactionAmount;
            await client.query(
                `UPDATE employee_balances 
                 SET balance = $1, updated_at = NOW()
                 WHERE club_id = $2 AND user_id = $3`,
                [newBalance, clubId, employee_id]
            );

            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                transaction: transactionResult.rows[0],
                new_balance: newBalance
            });

        } catch (error: any) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Create Balance Transaction Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
