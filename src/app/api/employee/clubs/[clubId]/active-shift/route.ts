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

        // Verify employee belongs to club
        const employeeCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if (employeeCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get active shift
        const shiftResult = await query(
            `SELECT 
        id,
        check_in,
        EXTRACT(EPOCH FROM (NOW() - check_in)) / 3600 as total_hours
       FROM shifts
       WHERE user_id = $1 AND club_id = $2 AND check_out IS NULL
       LIMIT 1`,
            [userId, clubId]
        );

        if (shiftResult.rowCount === 0) {
            return NextResponse.json({ shift: null });
        }

        const shift = shiftResult.rows[0];

        return NextResponse.json({
            shift: {
                id: shift.id,
                check_in: shift.check_in,
                total_hours: parseFloat(shift.total_hours) || 0
            }
        });

    } catch (error) {
        console.error('Get Active Shift Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
