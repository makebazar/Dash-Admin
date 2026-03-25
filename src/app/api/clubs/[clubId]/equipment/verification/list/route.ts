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
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Default to active (PENDING or REJECTED) if no status provided or status is not history
        let statusFilter = "t.verification_status IN ('PENDING', 'REJECTED')";
        
        if (status === 'history') {
            statusFilter = "t.verification_status = 'APPROVED'";
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
                t.verified_at,
                u.full_name as completed_by_name,
                vu.full_name as verified_by_name,
                t.photos,
                t.notes,
                t.verification_note,
                t.rejection_reason,
                t.bonus_earned,
                t.kpi_points,
                lr.id as laundry_request_id,
                lr.status as laundry_status
             FROM equipment_maintenance_tasks t
             JOIN equipment e ON t.equipment_id = e.id
             LEFT JOIN club_workstations cw ON e.workstation_id = cw.id
             LEFT JOIN users u ON t.completed_by = u.id
             LEFT JOIN users vu ON t.verified_by = vu.id
             LEFT JOIN LATERAL (
                SELECT id, status
                FROM equipment_laundry_requests
                WHERE equipment_id = e.id
                  AND (
                    maintenance_task_id = t.id
                    OR maintenance_task_id IS NULL
                  )
                  AND status IN ('NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN')
                ORDER BY created_at DESC
                LIMIT 1
             ) lr ON TRUE
             WHERE e.club_id = $1 
               AND ${statusFilter}
             ORDER BY COALESCE(t.completed_at, t.verified_at) DESC`,
            [clubId]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Fetch Verification Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
