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
        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await query(
            `SELECT t.*, w.name as workstation_name, w.zone, u.full_name as assigned_to
             FROM pc_maintenance_tasks t
             JOIN club_workstations w ON t.workstation_id = w.id
             LEFT JOIN users u ON t.assigned_user_id = u.id
             WHERE w.club_id = $1 AND t.month = $2 AND t.year = $3
             ORDER BY w.zone, w.name`,
            [clubId, month, year]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Maintenance Tasks Error:', error);
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
        const { month, year } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only manager/owner can generate tasks
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Insert tasks for all active workstations that don't have them yet for this month
        await query(
            `INSERT INTO pc_maintenance_tasks (workstation_id, month, year)
             SELECT id, $2, $3 FROM club_workstations
             WHERE club_id = $1 AND is_active = TRUE
             ON CONFLICT (workstation_id, month, year) DO NOTHING`,
            [clubId, month, year]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Generate Maintenance Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
