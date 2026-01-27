import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ shiftId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { shiftId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { indicators } = await request.json();

        // 1. Verify shift is ACTIVE and belongs to the user
        const shiftRes = await query(
            `SELECT id, status, club_id FROM shifts WHERE id = $1 AND user_id = $2`,
            [shiftId, userId]
        );

        if (shiftRes.rowCount === 0) {
            return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
        }

        const shift = shiftRes.rows[0];
        if (shift.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Shift is not active. Use the standard report to update closed shifts.' }, { status: 400 });
        }

        // 2. Update report_data (intermediate indicators)
        // We preserve existing data and merge new indicators
        await query(
            `UPDATE shifts 
             SET report_data = COALESCE(report_data::jsonb, '{}'::jsonb) || $1::jsonb,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(indicators), shiftId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Update Indicators Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
