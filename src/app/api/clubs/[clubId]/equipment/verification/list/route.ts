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

        // Active tab must include both current tasks and legacy completed tasks
        // where verification_status has not been backfilled yet.
        let statusFilter = `(
            (
                t.status = 'COMPLETED'
                AND (
                    t.verification_status IS NULL
                    OR t.verification_status IN ('PENDING', 'NONE')
                )
            )
            OR t.verification_status = 'REJECTED'
        )`;
        
        if (status === 'history') {
            statusFilter = "COALESCE(t.verification_status, '') = 'APPROVED'";
        }

        const result = await query(
            `SELECT 
                t.id,
                t.equipment_id,
                e.name as equipment_name,
                e.type as equipment_type,
                et.name_ru as equipment_type_name,
                cw.name as workstation_name,
                cw.zone as zone_name,
                t.task_type,
                t.status,
                t.verification_status,
                t.due_date,
                t.completed_at,
                t.verified_at,
                CASE
                    WHEN t.verification_status = 'REJECTED'
                    THEN GREATEST((CURRENT_DATE - COALESCE(t.verified_at::date, t.completed_at::date, t.due_date::date)), 0)
                    ELSE 0
                END as rework_days,
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
             LEFT JOIN equipment_types et ON e.type = et.code
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

        const rows = result.rows;
        const taskIds = rows.map((row) => row.id).filter(Boolean);
        let historyByTaskId = new Map<string, any[]>();

        if (taskIds.length > 0) {
            const historyRes = await query(
                `SELECT
                    ev.id,
                    ev.task_id,
                    ev.cycle_no,
                    ev.event_type,
                    ev.note,
                    ev.task_notes,
                    ev.photos,
                    ev.created_at,
                    COALESCE(u.full_name, 'Система') AS actor_name
                 FROM equipment_maintenance_task_events ev
                 LEFT JOIN users u ON u.id = ev.actor_user_id
                 WHERE ev.task_id = ANY($1::uuid[])
                 ORDER BY ev.created_at ASC, ev.id ASC`,
                [taskIds]
            );

            historyByTaskId = historyRes.rows.reduce((acc, item) => {
                const key = String(item.task_id);
                const list = acc.get(key) || [];
                list.push(item);
                acc.set(key, list);
                return acc;
            }, new Map<string, any[]>());
        }

        return NextResponse.json(
            rows.map((row) => ({
                ...row,
                history: historyByTaskId.get(String(row.id)) || [],
            }))
        );
    } catch (error) {
        console.error('Fetch Verification Tasks Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
