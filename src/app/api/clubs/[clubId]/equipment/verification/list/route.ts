import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

        const result = await query(
            `SELECT 
                t.id,
                t.equipment_id,
                e.name as equipment_name,
                e.type as equipment_type,
                cw.name as workstation_name,
                cw.zone as zone_name,
                t.task_type,
                t.status,
                t.verification_status,
                t.due_date,
                t.completed_at,
                u.full_name as completed_by_name,
                t.photos,
                t.notes,
                t.bonus_earned,
                t.kpi_points
             FROM equipment_maintenance_tasks t
             JOIN equipment e ON t.equipment_id = e.id
             LEFT JOIN club_workstations cw ON e.workstation_id = cw.id
             LEFT JOIN users u ON t.completed_by = u.id
             WHERE e.club_id = $1 
               AND t.verification_status = 'PENDING'
             ORDER BY t.completed_at ASC`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Fetch Verification Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
