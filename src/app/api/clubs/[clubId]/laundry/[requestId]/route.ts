import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';
import { hasActiveClubAccess } from '@/lib/maintenance-task-logic';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = ['NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN', 'RETURNED', 'CANCELLED'];

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; requestId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, requestId } = await params;
        const { status } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!(await hasActiveClubAccess(clubId, userId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!ALLOWED_STATUSES.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const requestCheck = await query(
            `SELECT id, maintenance_task_id
             FROM equipment_laundry_requests
             WHERE id = $1 AND club_id = $2`,
            [requestId, clubId]
        );

        if ((requestCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Laundry request not found' }, { status: 404 });
        }

        const completedAt = ['RETURNED', 'CANCELLED'].includes(status) ? 'CURRENT_TIMESTAMP' : 'NULL';

        const result = await query(
            `UPDATE equipment_laundry_requests
             SET status = $1,
                 processed_by = $2,
                 completed_at = ${completedAt}
             WHERE id = $3
             RETURNING *`,
            [status, userId, requestId]
        );

        const maintenanceTaskId = requestCheck.rows[0]?.maintenance_task_id;
        if (maintenanceTaskId && ['RETURNED', 'CANCELLED'].includes(status)) {
            const statusLabel = status === 'RETURNED' ? 'Возвращён из стирки' : 'Стирка отменена';
            await query(
                `UPDATE equipment_maintenance_tasks
                 SET notes = CASE
                       WHEN notes IS NULL OR notes = '' THEN $1
                       WHEN POSITION($1 IN notes) > 0 THEN notes
                       ELSE notes || E'\n' || $1
                     END,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [`[Стирка] ${statusLabel}`, maintenanceTaskId]
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Laundry Request Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
