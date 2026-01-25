import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// GET - Get active shifts for current user
export async function GET() {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active shifts for this user
        const result = await query(
            `SELECT 
        s.id,
        s.club_id,
        c.name as club_name,
        s.check_in,
        EXTRACT(EPOCH FROM (NOW() - s.check_in)) / 3600 as total_hours
       FROM shifts s
       JOIN clubs c ON s.club_id = c.id
       WHERE s.user_id = $1 AND s.check_out IS NULL
       ORDER BY s.check_in DESC`,
            [userId]
        );

        return NextResponse.json({
            shifts: result.rows.map(row => ({
                id: row.id,
                club_id: row.club_id,
                club_name: row.club_name,
                check_in: row.check_in,
                total_hours: parseFloat(row.total_hours) || 0
            }))
        });

    } catch (error) {
        console.error('Get Active Shifts Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
