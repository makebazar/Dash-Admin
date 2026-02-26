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
        const photos = body.photos || null;

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

        // 0. Get KPI Config from Active Salary Scheme & Current Task Info
        // We fetch the active salary scheme for this user to get their specific KPI rates
        const [schemeRes, taskRes] = await Promise.all([
            query(
                `SELECT sv.formula
                 FROM employee_salary_assignments esa
                 JOIN salary_schemes ss ON esa.scheme_id = ss.id
                 JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
                 WHERE esa.user_id = $1 AND esa.club_id = $2
                 ORDER BY sv.version DESC
                 LIMIT 1`,
                [userId, clubId]
            ),
            query(`SELECT due_date, task_type FROM equipment_maintenance_tasks WHERE id = $1`, [taskId])
        ]);
        
        const schemeFormula = schemeRes.rows[0]?.formula || {};
        const bonuses = schemeFormula.bonuses || [];
        // Find the maintenance KPI bonus config (handle potential case sensitivity)
        const kpiBonus = bonuses.find((b: any) => b.type === 'maintenance_kpi' || b.type === 'MAINTENANCE_KPI');
        const task = taskRes.rows[0];

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // 1. Calculate Bonus & Check Smart Deadline
        let bonusEarned = 0;
        let kpiPoints = 1; // Default to 1 point per task (internal counter)
        let appliedMultiplier = 1.0;

        if (kpiBonus) {
            // Price per task is defined in the bonus amount
            const baseValue = Number(kpiBonus.amount) || 0;

            // Check deadline
            const now = new Date();
            const dueDate = new Date(task.due_date);
            const diffTime = now.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Allow tolerance
            const tolerance = Number(kpiBonus.overdue_tolerance_days) || 3;
            
            if (diffDays > tolerance) {
                // Late
                appliedMultiplier = Number(kpiBonus.late_penalty_multiplier) || 0.5;
            } else {
                // On Time (or within tolerance)
                // Default on time multiplier is 1.0, unless we want to add an "early bird" bonus later
                appliedMultiplier = 1.0;
            }

            bonusEarned = baseValue * appliedMultiplier;
        }

        const completeTask = await query(
            `UPDATE equipment_maintenance_tasks
             SET status = 'COMPLETED',
                 verification_status = 'PENDING',
                 completed_at = CURRENT_TIMESTAMP,
                 completed_by = $2,
                 photos = $3,
                 bonus_earned = $4,
                 kpi_points = $5,
                 applied_kpi_multiplier = $6
             WHERE id = $1
             RETURNING equipment_id`,
            [taskId, userId, photos, bonusEarned, kpiPoints, appliedMultiplier]
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
            `SELECT cleaning_interval_days, workstation_id, assigned_user_id, maintenance_enabled FROM equipment WHERE id = $1`,
            [equipmentId]
        );
        
        const equipment = equipmentRes.rows[0];
        
        // 4. Create next task if interval is set
        if (equipment && equipment.maintenance_enabled !== false) {
             const rawInterval = equipment.cleaning_interval_days;
             const intervalDays = Math.max(1, rawInterval || 30);
             
             const nextDueDate = new Date();
             nextDueDate.setDate(nextDueDate.getDate() + intervalDays);
             const nextDueDateStr = nextDueDate.toISOString().split('T')[0];
             
             // Find shift for assigned user if any AND user is active
             let finalDate = nextDueDateStr;
             const assignedUserId = equipment.assigned_user_id;
             
             if (assignedUserId) {
                 // Check if user is active first
                 const userActiveRes = await query(
                     `SELECT is_active FROM club_employees WHERE club_id = $1 AND user_id = $2`,
                     [clubId, assignedUserId]
                 );
                 
                 const isActive = userActiveRes.rows[0]?.is_active !== false;

                 if (isActive) {
                     // Simple shift lookup - get next working day >= nextDueDateStr
                     const shiftRes = await query(
                         `SELECT date FROM work_schedules 
                          WHERE club_id = $1 AND user_id = $2 AND date >= $3
                          ORDER BY date ASC LIMIT 1`,
                         [clubId, assignedUserId, nextDueDateStr]
                     );
                     if (shiftRes.rowCount && shiftRes.rowCount > 0) {
                         // Ensure we have a string YYYY-MM-DD
                         const d = shiftRes.rows[0].date;
                         finalDate = d instanceof Date ? d.toISOString().split('T')[0] : d;
                     }
                 }
             }

             // CLEANUP: Delete any other PENDING tasks for this equipment to ensure "Smart Horizon"
             // This removes "ghost" tasks that might have incorrect dates (like 31.01)
             await query(
                 `DELETE FROM equipment_maintenance_tasks 
                  WHERE equipment_id = $1 AND status = 'PENDING' AND id != $2`,
                 [equipmentId, taskId]
             );

             await query(
                 `INSERT INTO equipment_maintenance_tasks (
                     equipment_id, 
                     status, 
                     due_date,
                     task_type,
                     assigned_user_id
                 ) VALUES ($1, 'PENDING', $2, 'CLEANING', $3)
                 ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING`,
                 [equipmentId, finalDate, assignedUserId]
             );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Complete Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
