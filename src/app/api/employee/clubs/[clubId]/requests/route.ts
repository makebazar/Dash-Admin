import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessCheck = await query(
            `
            SELECT 1
            FROM club_employees
            WHERE club_id = $1 AND user_id = $2 AND is_active = true
            UNION
            SELECT 1
            FROM clubs
            WHERE id = $1 AND owner_id = $2
            LIMIT 1
            `,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const res = await query(
            `
            SELECT r.*, NULL::text as workstation_name
            FROM employee_requests r
            WHERE r.club_id = $1
            ORDER BY r.updated_at DESC, r.created_at DESC
            `,
            [parseInt(clubId, 10)]
        );

        return NextResponse.json({
            requests: res.rows.map((row) => ({
                ...row,
                is_archived: row.is_archived || false,
                photo_urls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
            })),
        });
    } catch (error) {
        console.error('Get Employee Requests API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
