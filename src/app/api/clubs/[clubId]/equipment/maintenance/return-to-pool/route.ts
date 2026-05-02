import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/db';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params;
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        
        if (!userId) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { task_ids, user_id, reason } = body;

        if (!user_id) {
            return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
        }

        // Verify user belongs to club
        const userCheck = await query(
            `SELECT ce.user_id, u.full_name
             FROM club_employees ce
             JOIN users u ON u.id = ce.user_id
             WHERE ce.club_id = $1 AND ce.user_id = $2 AND ce.is_active = TRUE AND ce.dismissed_at IS NULL`,
            [clubId, user_id]
        );

        if (userCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Сотрудник не найден или неактивен' }, { status: 404 });
        }

        const userName = userCheck.rows[0].full_name;

        let tasksToUpdate: string[] = [];
        if (task_ids && task_ids.length > 0) {
            tasksToUpdate = task_ids;
        } else {
            // Find all PENDING tasks assigned to this user
            const pendingResult = await query(
                `SELECT id FROM equipment_maintenance_tasks
                 WHERE club_id = $1 AND assigned_user_id = $2 AND status = 'PENDING'`,
                [clubId, user_id]
            );
            tasksToUpdate = pendingResult.rows.map((r: any) => r.id);
        }

        if (tasksToUpdate.length === 0) {
            return NextResponse.json({
                success: true,
                updated: 0,
                message: 'Нет задач для обновления'
            });
        }

        const result = await query(
            `UPDATE equipment_maintenance_tasks
             SET assigned_user_id = NULL,
                 notes = COALESCE(notes || E'\n', '') || $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($2) AND status = 'PENDING'
             RETURNING id`,
            [`[${new Date().toISOString()}] Возврат в пул: сотрудник ${userName}. Причина: ${reason || 'Не указана'}`, tasksToUpdate]
        );

        return NextResponse.json({
            success: true,
            updated: result.rowCount,
            tasks: result.rows
        });

    } catch (error: any) {
        console.error('Bulk return to pool error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}