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

        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );
        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `SELECT
                sp.id,
                sp.amount,
                sp.payment_type,
                sp.comment,
                sp.paid_at,
                u.full_name as employee_name
             FROM salary_payments sp
             JOIN users u ON sp.user_id = u.id
             WHERE sp.club_id = $1
             ORDER BY sp.paid_at DESC
             LIMIT 100`,
            [clubId]
        );

        return NextResponse.json({ payments: result.rows });
    } catch (error) {
        console.error('Payments API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT id FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { employee_id, amount, payment_type, comment } = body;

        if (!employee_id || !amount || !payment_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO salary_payments
                (club_id, user_id, amount, payment_type, comment, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [clubId, employee_id, amount, payment_type, comment, userId]
        );

        return NextResponse.json({ success: true, id: result.rows[0].id });

    } catch (error) {
        console.error('Create Payment Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
