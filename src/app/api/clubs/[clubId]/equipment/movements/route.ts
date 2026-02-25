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

        // Get movements
        const movementsQuery = `
            SELECT 
                m.id,
                m.moved_at,
                m.reason,
                e.name as equipment_name,
                e.type as equipment_type,
                ws_from.name as from_workstation_name,
                ws_from.zone as from_zone,
                ws_to.name as to_workstation_name,
                ws_to.zone as to_zone,
                u.full_name as moved_by_name
            FROM equipment_moves m
            JOIN equipment e ON m.equipment_id = e.id
            LEFT JOIN club_workstations ws_from ON m.from_workstation_id = ws_from.id
            LEFT JOIN club_workstations ws_to ON m.to_workstation_id = ws_to.id
            LEFT JOIN users u ON m.moved_by = u.id
            WHERE e.club_id = $1
            ORDER BY m.moved_at DESC
            LIMIT 100
        `;

        const result = await query(movementsQuery, [clubId]);

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Get Equipment Movements Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
