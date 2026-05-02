import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string; taskId: string }> }
) {
    try {
        const { clubId, taskId } = await params;
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        
        if (!userId) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { reason } = body;

        // Get task info
        const taskResult = await query(
            `SELECT id, assigned_user_id, equipment_id, status, due_date
             FROM equipment_maintenance_tasks
             WHERE id = $1 AND club_id = $2`,
            [taskId, clubId]
        );

        if (taskResult.rowCount === 0) {
            return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
        }

        const task = taskResult.rows[0];

        if (task.status !== 'PENDING') {
            return NextResponse.json({ error: 'Можно вернуть в пул только задачи в статусе PENDING' }, { status: 400 });
        }

        if (!task.assigned_user_id) {
            return NextResponse.json({ error: 'Задача уже в пуле' }, { status: 400 });
        }

        // Get previous assignee name for audit
        const userResult = await query(
            `SELECT full_name FROM users WHERE id = $1`,
            [task.assigned_user_id]
        );
        const previousAssigneeName = userResult.rows[0]?.full_name || 'Неизвестно';

        // Return task to pool
        const updateResult = await query(
            `UPDATE equipment_maintenance_tasks
             SET assigned_user_id = NULL,
                 notes = COALESCE(notes || E'\n', '') || $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, assigned_user_id`,
            [`[${new Date().toISOString()}] Возврат в пул. Причина: ${reason || 'Не указана'}. Был назначен: ${previousAssigneeName}`, taskId]
        );

        // Get equipment info for response
        const equipResult = await query(
            `SELECT e.name, et.name_ru as type_name
             FROM equipment e
             JOIN equipment_types et ON e.type = et.code
             WHERE e.id = $1`,
            [task.equipment_id]
        );

        return NextResponse.json({
            success: true,
            task_id: taskId,
            previous_assignee: previousAssigneeName,
            equipment: equipResult.rows[0],
            due_date: task.due_date
        });

    } catch (error: any) {
        console.error('Return to pool error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}