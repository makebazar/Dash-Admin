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
        const kpiConfig = schemeFormula.maintenance_kpi || null;
        const task = taskRes.rows[0];

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // 1. Calculate Bonus & Check Smart Deadline
        let bonusEarned = 0;
        let kpiPoints = 1;
        let appliedMultiplier = 1.0;

        if (kpiConfig && kpiConfig.enabled) {
            // Base points
            kpiPoints = task.task_type === 'REPAIR' 
                ? (kpiConfig.points_per_issue_resolved || 3)
                : (kpiConfig.points_per_cleaning || 1);
            
            const baseValue = kpiPoints * (Number(kpiConfig.bonus_per_point) || 0);

            // Check deadline
            const now = new Date();
            const dueDate = new Date(task.due_date);
            const diffTime = now.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Allow tolerance (Smart Deadline logic part 1: Tolerance Window)
            const tolerance = kpiConfig.overdue_tolerance_days || 3;
            
            if (diffDays > tolerance) {
                // Late
                appliedMultiplier = Number(kpiConfig.late_penalty_multiplier) || 0.5;
            } else {
                // On Time (or within tolerance)
                appliedMultiplier = Number(kpiConfig.on_time_multiplier) || 1.0;
            }

            // TODO: In future, add Shift-Aware logic here (check work_schedules)
            // If user had no shifts between due_date and now, appliedMultiplier = 1.0

            bonusEarned = baseValue * appliedMultiplier;
        }

        const completeTask = await query(
            `UPDATE equipment_maintenance_tasks
             SET status = 'COMPLETED',
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
                 ) VALUES ($1, 'PENDING', $2, 'CLEANING')
                 ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING`,
                 [equipmentId, nextDueDate]
             );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Complete Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
