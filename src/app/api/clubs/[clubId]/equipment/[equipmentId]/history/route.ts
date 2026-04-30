import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';

export async function GET(
    _request: Request,
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

        const hasMaintenancePhotos = await hasColumn('equipment_maintenance_tasks', 'photos');
        const hasIssueResolutionPhotos = await hasColumn('equipment_issues', 'resolution_photos');

        // Combine maintenance tasks and moves
        const historyQuery = `
            (
                SELECT 
                    id, 
                    'MAINTENANCE' as action_type, 
                    task_type as action, 
                    completed_at as date, 
                    (SELECT full_name FROM users WHERE id = completed_by) as user_name,
                    notes as details,
                    ${hasMaintenancePhotos ? `COALESCE(photos, ARRAY[]::text[])` : `ARRAY[]::text[]`} as photos
                FROM equipment_maintenance_tasks
                WHERE equipment_id = $1 AND status = 'COMPLETED'
            )
            UNION ALL
            (
                SELECT
                    id,
                    'REWORK' as action_type,
                    task_type as action,
                    verified_at as date,
                    (SELECT full_name FROM users WHERE id = verified_by) as user_name,
                    rejection_reason as details,
                    ARRAY[]::text[] as photos
                FROM equipment_maintenance_tasks
                WHERE equipment_id = $1
                  AND verification_status = 'REJECTED'
                  AND verified_at IS NOT NULL
            )
            UNION ALL
            (
                SELECT 
                    id, 
                    'MOVE' as action_type, 
                    'Перемещение' as action, 
                    moved_at as date, 
                    (SELECT full_name FROM users WHERE id = moved_by) as user_name,
                    reason as details,
                    ARRAY[]::text[] as photos
                FROM equipment_moves
                WHERE equipment_id = $1
            )
            UNION ALL
            (
                SELECT
                    uuid_generate_v4() as id,
                    'MOVE' as action_type,
                    'Межклубное перемещение' as action,
                    t.created_at as date,
                    (SELECT full_name FROM users WHERE id = t.created_by) as user_name,
                    ('Отправлено: ' || sc.name || ' → ' || tc.name ||
                        CASE
                            WHEN i.target_workstation_id IS NULL THEN '. Поставить: склад'
                            ELSE '. Поставить: ' || COALESCE(tw.name, 'место')
                        END ||
                        CASE
                            WHEN t.comment IS NULL OR t.comment = '' THEN ''
                            ELSE '. ' || t.comment
                        END
                    ) as details,
                    ARRAY[]::text[] as photos
                FROM equipment_transfer_items i
                JOIN equipment_transfers t ON t.id = i.transfer_id
                LEFT JOIN clubs sc ON sc.id = t.source_club_id
                LEFT JOIN clubs tc ON tc.id = t.target_club_id
                LEFT JOIN club_workstations tw ON tw.id = i.target_workstation_id
                WHERE i.equipment_id = $1
            )
            UNION ALL
            (
                SELECT
                    uuid_generate_v4() as id,
                    'MOVE' as action_type,
                    'Межклубное перемещение (принято)' as action,
                    t.completed_at as date,
                    (SELECT full_name FROM users WHERE id = t.completed_by) as user_name,
                    ('Принято: ' || sc.name || ' → ' || tc.name ||
                        CASE
                            WHEN i.target_workstation_id IS NULL THEN '. Поставлено: склад'
                            ELSE '. Поставлено: ' || COALESCE(tw.name, 'место')
                        END
                    ) as details,
                    ARRAY[]::text[] as photos
                FROM equipment_transfer_items i
                JOIN equipment_transfers t ON t.id = i.transfer_id
                LEFT JOIN clubs sc ON sc.id = t.source_club_id
                LEFT JOIN clubs tc ON tc.id = t.target_club_id
                LEFT JOIN club_workstations tw ON tw.id = i.target_workstation_id
                WHERE i.equipment_id = $1 AND t.completed_at IS NOT NULL
            )
            UNION ALL
            (
                SELECT 
                    id, 
                    'ISSUE' as action_type, 
                    'Инцидент: ' || title as action, 
                    created_at as date, 
                    (SELECT full_name FROM users WHERE id = reported_by) as user_name,
                    description as details,
                    ${hasIssueResolutionPhotos ? `COALESCE(resolution_photos, ARRAY[]::text[])` : `ARRAY[]::text[]`} as photos
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
