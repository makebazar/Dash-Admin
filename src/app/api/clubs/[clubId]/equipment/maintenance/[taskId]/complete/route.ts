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

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access (employee or owner)
        const accessCheck = await query(
            `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. Mark task as COMPLETED
        const completeTask = await query(
            `UPDATE equipment_maintenance_tasks
             SET status = 'COMPLETED',
                 completed_at = CURRENT_TIMESTAMP,
                 completed_by = $2
             WHERE id = $1
             RETURNING equipment_id`,
            [taskId, userId]
        );

        if ((completeTask.rowCount || 0) === 0) {
             return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const equipmentId = completeTask.rows[0].equipment_id;

        // 2. Update equipment last_cleaned_at
        await query(
            `UPDATE equipment
             SET last_cleaned_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [equipmentId]
        );

        // 3. Get equipment details for next task scheduling
        const equipmentRes = await query(
            `SELECT cleaning_interval_days, workstation_id FROM equipment WHERE id = $1`,
            [equipmentId]
        );
        
        const equipment = equipmentRes.rows[0];
        
        // 4. Create next task if interval is set
        if (equipment && equipment.cleaning_interval_days > 0) {
             const nextDueDate = new Date();
             nextDueDate.setDate(nextDueDate.getDate() + equipment.cleaning_interval_days);
             
             await query(
                 `INSERT INTO equipment_maintenance_tasks (
                     equipment_id, 
                     status, 
                     due_date,
                     task_type
                 ) VALUES ($1, 'PENDING', $2, 'CLEANING')`,
                 [equipmentId, nextDueDate]
             );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Complete Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
