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

        // Verify ownership
        const ownerCheck = await query(
            `SELECT id FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if (ownerCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get active shifts
        const result = await query(
            `SELECT 
        s.id,
        s.check_in,
        s.total_hours,
        u.full_name as user_name,
        r.name as role_name
       FROM shifts s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       JOIN shift_reports sr ON s.shift_report_id = sr.id
       WHERE sr.club_id = $1 AND s.status = 'ACTIVE'
       ORDER BY s.check_in DESC`,
            [clubId]
        );

        const shifts = result.rows.map(row => ({
            id: row.id,
            user_name: row.user_name,
            role: row.role_name || 'Сотрудник',
            check_in: row.check_in,
            total_hours: parseFloat(row.total_hours || 0)
        }));

        return NextResponse.json({ shifts });

    } catch (error) {
        console.error('Get Active Shifts Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
