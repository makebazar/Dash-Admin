import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ clubId: string; paymentId: string }> }
) {
    try {
        const { clubId, paymentId } = await params;
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check ownership/permissions
        const ownerCheck = await query(`SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Get payment details before deletion
        const paymentRes = await query(
            `SELECT * FROM payments WHERE id = $1 AND club_id = $2`,
            [paymentId, clubId]
        );

        if (paymentRes.rowCount === 0) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        const payment = paymentRes.rows[0];

        // Start transaction for clean cleanup
        await query('BEGIN');

        try {
            // 1. If it's a salary payment, unfreeze shifts
            if (payment.payment_type === 'salary') {
                // Find shifts that have a snapshot with the same paid_at as this payment
                // We use string comparison for the timestamp in JSONB
                await query(
                    `UPDATE shifts
                     SET salary_snapshot = NULL
                     WHERE user_id = $1 
                        AND club_id = $2
                        AND salary_snapshot->>'paid_at' = $3`,
                    [payment.user_id, clubId, payment.created_at.toISOString()]
                );
            }

            // 2. Delete related finance transactions
            await query(
                `DELETE FROM finance_transactions WHERE related_payment_id = $1 AND club_id = $2`,
                [paymentId, clubId]
            );

            // 3. Delete the payment record
            await query(
                `DELETE FROM payments WHERE id = $1 AND club_id = $2`,
                [paymentId, clubId]
            );

            // 4. If it was linked to a balance transaction, delete that too
            if (payment.balance_transaction_id) {
                await query(
                    `DELETE FROM employee_balance_transactions WHERE id = $1 AND club_id = $2`,
                    [payment.balance_transaction_id, clubId]
                );
            }

            await query('COMMIT');
            
            return NextResponse.json({ message: 'Payment deleted successfully' });
        } catch (innerError) {
            await query('ROLLBACK');
            throw innerError;
        }

    } catch (error: any) {
        console.error('Error deleting payment:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
