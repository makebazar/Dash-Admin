import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; taskId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, taskId } = await params;
        
        let body;
        try {
            body = await request.json();
        } catch (e) {
            body = {};
        }
        const { action, comment } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (only owner or admin/manager can verify)
        // Adjust role check as needed. For now, let's assume club employees with sufficient rights or owners.
        const accessCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (action === 'REJECT' && !comment) {
            return NextResponse.json({ error: 'Comment is required for rejection' }, { status: 400 });
        }

        let updateQuery = '';
        let queryParams: any[] = [];

        if (action === 'APPROVE') {
            updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'APPROVED',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    verification_note = $3
                WHERE id = $1
                RETURNING id
            `;
            queryParams = [taskId, userId, comment || null];
        } else if (action === 'REJECT') {
            // Revert task status to IN_PROGRESS (or PENDING if it was never started, but usually completed tasks come from in_progress)
            // Reset completion data so it appears back in the queue
            // But keep track of the rejection reason
            updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'REJECTED',
                    status = 'IN_PROGRESS',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    rejection_reason = $3,
                    completed_at = NULL, -- Reset completion time
                    bonus_earned = 0,    -- Reset bonus
                    kpi_points = 0       -- Reset points
                WHERE id = $1
                RETURNING id
            `;
            queryParams = [taskId, userId, comment];
        }

        const result = await query(updateQuery, queryParams);

        if ((result.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Verify Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
