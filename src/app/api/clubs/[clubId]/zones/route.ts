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

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Auto-create missing zones from workstations to ensure they appear in the list
        await query(
            `INSERT INTO club_zones (club_id, name)
             SELECT DISTINCT w.club_id, w.zone
             FROM club_workstations w
             WHERE w.club_id = $1
             AND w.zone IS NOT NULL
             AND w.zone != ''
             AND NOT EXISTS (
                 SELECT 1 FROM club_zones z 
                 WHERE z.club_id = w.club_id 
                 AND z.name = w.zone
             )`,
            [clubId]
        );

        const result = await query(
            `SELECT 
                z.id,
                z.name,
                z.assigned_user_id,
                u.full_name as assigned_user_name,
                (SELECT COUNT(*) FROM club_workstations w WHERE w.club_id = z.club_id AND w.zone = z.name) as workstation_count
             FROM club_zones z
             LEFT JOIN users u ON z.assigned_user_id = u.id
             WHERE z.club_id = $1
             ORDER BY z.name`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Zones Error:', error);
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
        const body = await request.json();
        const { name, assigned_user_id } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!name) {
            return NextResponse.json({ error: 'Zone name is required' }, { status: 400 });
        }

        // Verify ownership/admin access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await query(
            `INSERT INTO club_zones (club_id, name, assigned_user_id)
             VALUES ($1, $2, $3)
             RETURNING id, name, assigned_user_id`,
            [clubId, name, assigned_user_id || null]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Create Zone Error:', error);
        if ((error as any).code === '23505') { // Unique violation
            return NextResponse.json({ error: 'Zone already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
