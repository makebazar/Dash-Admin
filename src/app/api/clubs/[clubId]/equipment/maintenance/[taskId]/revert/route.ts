import { NextResponse } from 'next/server'
import { query } from '@/db'
import { cookies } from 'next/headers'
import { appendMaintenanceTaskEvent, ensureMaintenanceTaskInitialHistory, getMaintenanceTaskCurrentCycle } from '@/lib/maintenance-task-events'

export const dynamic = 'force-dynamic'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ clubId: string; taskId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId, taskId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const accessCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        )

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const taskResult = await query(
            `SELECT mt.id, mt.status, mt.equipment_id, mt.task_type, mt.verification_status, mt.completed_at, mt.completed_by, mt.verified_at, mt.verified_by, mt.rejection_reason, mt.verification_note, mt.notes, mt.photos
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             WHERE mt.id = $1 AND e.club_id = $2`,
            [taskId, clubId]
        )

        if ((taskResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        const task = taskResult.rows[0]
        await ensureMaintenanceTaskInitialHistory(task)
        const currentCycle = await getMaintenanceTaskCurrentCycle(taskId)

        if (task.verification_status !== 'APPROVED') {
            return NextResponse.json({ error: 'Можно вернуть только одобренные задачи' }, { status: 409 })
        }

        await query(
            `UPDATE equipment_maintenance_tasks
             SET verification_status = 'PENDING',
                 verified_at = NULL,
                 verified_by = NULL,
                 verification_note = NULL,
                 rejection_reason = NULL
             WHERE id = $1`,
            [taskId]
        )

        await appendMaintenanceTaskEvent({
            taskId,
            cycleNo: Math.max(Number(currentCycle || 0), 1),
            eventType: 'REVERTED',
            actorUserId: userId,
            note: 'Вернули на проверку',
            taskNotes: task.notes || null,
            photos: task.photos || [],
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Revert Task Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

