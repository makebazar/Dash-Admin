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

        // Access check
        const accessCheck = await query(
            `
            SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
            UNION
            SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get 5 most recent shifts (active or closed)
        // Including user info
        const shifts = await query(
            `
            SELECT 
                s.id,
                s.check_in,
                s.check_out,
                s.status,
                s.user_id,
                u.full_name as employee_name,
                r.name as role
            FROM shifts s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE s.club_id = $1
            ORDER BY s.check_in DESC
            LIMIT 5
            `,
            [clubId]
        );

        return NextResponse.json({ shifts: shifts.rows });

    } catch (error) {
        console.error('Get Recent Shifts Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
