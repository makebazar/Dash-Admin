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
                s.id,
                s.check_in,
                s.bar_purchases,
                EXTRACT(EPOCH FROM (NOW() - s.check_in)) / 3600 as total_hours,
                (r.default_kpi_settings->>'base_rate')::numeric as hourly_rate
            FROM shifts s
            JOIN users u ON s.user_id = u.id
            JOIN roles r ON u.role_id = r.id
            WHERE s.user_id = $1 AND s.club_id = $2 AND s.check_out IS NULL
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
                bar_purchases: parseFloat(shift.bar_purchases || '0'),
                total_hours: parseFloat(shift.total_hours) || 0,
                hourly_rate: parseFloat(shift.hourly_rate || '150')
            }
        });

    } catch (error) {
        console.error('Get Active Shift Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
