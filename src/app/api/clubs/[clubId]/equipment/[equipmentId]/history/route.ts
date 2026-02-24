import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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

        // Verify equipment belongs to club
        const equipmentCheck = await query(
            `SELECT id FROM equipment WHERE id = $1 AND club_id = $2`,
            [equipmentId, clubId]
        );

        if ((equipmentCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
        }

        // Combine maintenance tasks and moves
        const historyQuery = `
            (
                SELECT 
                    id, 
                    'MAINTENANCE' as action_type, 
                    task_type as action, 
                    completed_at as date, 
                    (SELECT full_name FROM users WHERE id = completed_by) as user_name,
                    notes as details
                FROM equipment_maintenance_tasks
                WHERE equipment_id = $1 AND status = 'COMPLETED'
            )
            UNION ALL
            (
                SELECT 
                    id, 
                    'MOVE' as action_type, 
                    'Перемещение' as action, 
                    moved_at as date, 
                    (SELECT full_name FROM users WHERE id = moved_by) as user_name,
                    reason as details
                FROM equipment_moves
                WHERE equipment_id = $1
            )
            UNION ALL
            (
                SELECT 
                    id, 
                    'ISSUE' as action_type, 
                    'Инцидент: ' || title as action, 
                    created_at as date, 
                    (SELECT full_name FROM users WHERE id = reported_by) as user_name,
                    description as details
                FROM equipment_issues
                WHERE equipment_id = $1
            )
            ORDER BY date DESC
        `;

        const result = await query(historyQuery, [equipmentId]);

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Equipment History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
