import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

// POST /api/clubs/[clubId]/equipment/[equipmentId]/issues - Report an issue
export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (employee or owner)
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { title, description, priority, maintenance_task_id } = body;

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const result = await query(
            `INSERT INTO equipment_issues (
                equipment_id, 
                reported_by, 
                title, 
                description, 
                priority, 
                status,
                maintenance_task_id
            )
             VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)
             RETURNING *`,
            [
                equipmentId, 
                userId, 
                title, 
                description || null, 
                priority || 'MEDIUM',
                maintenance_task_id || null
            ]
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Report Issue Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET /api/clubs/[clubId]/equipment/[equipmentId]/issues - Get issues for equipment
export async function GET(
    request: Request,
    { params }: { params: Promise<{ clubId: string; equipmentId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, equipmentId } = await params;

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

        const result = await query(
            `SELECT i.*, u.full_name as reported_by_name
             FROM equipment_issues i
             LEFT JOIN users u ON i.reported_by = u.id
             WHERE i.equipment_id = $1
             ORDER BY i.created_at DESC`,
            [equipmentId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Issues Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
