import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST /api/clubs/[clubId]/finance/scheduled/[expenseId]/pay
export async function POST(
    request: NextRequest,
    { params }: { params: { clubId: string; expenseId: string } }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { clubId, expenseId } = params;
        const body = await request.json();

        const {
            amount,
            account_id,
            payment_date,
            description,
            payment_method = 'other'
        } = body;

        if (!amount || !account_id || !payment_date) {
            return NextResponse.json(
                { error: 'amount, account_id, and payment_date are required' },
                { status: 400 }
            );
        }

        // Get scheduled expense details
        const expenseResult = await query(
            `SELECT * FROM finance_scheduled_expenses WHERE id = $1 AND club_id = $2`,
            [expenseId, clubId]
        );

        if (expenseResult.rows.length === 0) {
            return NextResponse.json({ error: 'Scheduled expense not found' }, { status: 404 });
        }

        const expense = expenseResult.rows[0];

        // Create transaction linked to the scheduled expense
        const transactionResult = await query(
            `INSERT INTO finance_transactions 
                (club_id, category_id, amount, type, payment_method, status, 
                 transaction_date, description, created_by, account_id, scheduled_expense_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                clubId,
                expense.category_id,
                amount,
                'expense',
                payment_method,
                'completed',
                payment_date,
                description || `Оплата: ${expense.name}`,
                userId,
                account_id,
                expenseId
            ]
        );

        // The trigger trg_update_scheduled_expense_status will automatically update 
        // the status of the scheduled expense.

        return NextResponse.json({
            transaction: transactionResult.rows[0],
            message: 'Payment recorded successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('Error recording payment for scheduled expense:', error);
        return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }
}
