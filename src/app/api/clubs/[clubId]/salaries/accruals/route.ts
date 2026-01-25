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

        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const ownerCheck = await query(`SELECT id FROM clubs WHERE id=$1 AND owner_id=$2`, [clubId, userId]);
        if (ownerCheck.rowCount === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const result = await query(
            `SELECT s.id, s.check_in, s.check_out, s.total_hours, s.calculated_salary, s.salary_breakdown, s.status, u.full_name, r.name as role_name
             FROM shifts s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE s.club_id = $1 AND s.calculated_salary IS NOT NULL AND s.check_out IS NOT NULL
             ORDER BY s.check_in DESC LIMIT 100`,
            [clubId]
        );

        return NextResponse.json({ accruals: result.rows });
    } catch (error) {
        console.error('Accruals Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
