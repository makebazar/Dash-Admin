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

        // Verify owner
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id=$1 AND owner_id=$2`,
            [clubId, userId]
        );
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        // Get payment to find timestamp
        const paymentRes = await query(
            `SELECT created_at, user_id FROM payments WHERE id = $1 AND club_id = $2`,
            [paymentId, clubId]
        );

        if (paymentRes.rowCount === 0) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        const payment = paymentRes.rows[0];
        // Note: paid_at in snapshot is stored as string in JSONB, might need careful comparison
        // But usually it matches the ISO string format.

        // 1. Delete payment
        await query(`DELETE FROM payments WHERE id = $1`, [paymentId]);

        // 2. Unfreeze shifts (remove snapshot)
        // We match shifts that have this specific paid_at timestamp in their snapshot
        // casting jsonb->>'paid_at' to timestamp might be safer, or just string compare

        await query(
            `UPDATE shifts
             SET salary_snapshot = NULL
             WHERE user_id = $1 
               AND club_id = $2
               AND salary_snapshot->>'paid_at' = $3`,
            [payment.user_id, clubId, new Date(payment.created_at).toISOString()]
        );

        return NextResponse.json({ success: true, message: 'Payment deleted and shifts unfrozen' });

    } catch (error) {
        console.error('Error deleting payment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
