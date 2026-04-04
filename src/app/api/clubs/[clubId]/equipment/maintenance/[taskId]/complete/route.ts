import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';
import { calculateMaintenanceOverduePenalty } from '@/lib/maintenance-penalties';
import { formatDateKeyInTimezone, parseDateKey } from '@/lib/utils';

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
        const notes = body.notes || null;

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

            // Penalties removed as per request
            appliedMultiplier = 1.0;

            bonusEarned = baseValue * appliedMultiplier;
        }

        const overdueDaysAtCompletion = Math.max(0, Math.floor(
            (new Date(new Date().toDateString()).getTime() - new Date(new Date(task.due_date).toDateString()).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const wasOverdue = overdueDaysAtCompletion > 0;
        const responsibleUserIdAtCompletion = userId;
        const overduePenaltyPreview = calculateMaintenanceOverduePenalty(
            {
                overdue_tolerance_days: kpiBonus?.overdue_tolerance_days,
                overdue_penalty_mode: kpiBonus?.overdue_penalty_mode,
                overdue_penalty_amount: kpiBonus?.overdue_penalty_amount,
                late_penalty_multiplier: kpiBonus?.late_penalty_multiplier
            },
            [{ overdue_days_at_completion: overdueDaysAtCompletion, bonus_earned: bonusEarned, was_overdue: wasOverdue }]
        );

        const completeTask = await query(
            `UPDATE equipment_maintenance_tasks
             SET status = 'COMPLETED',
                 verification_status = 'PENDING',
                 completed_at = CURRENT_TIMESTAMP,
                 completed_by = $2,
                 photos = $3,
                 notes = $4,
                 bonus_earned = $5,
                 kpi_points = $6,
                 applied_kpi_multiplier = $7,
                 overdue_days_at_completion = $8,
                 was_overdue = $9,
                 responsible_user_id_at_completion = $10
             WHERE id = $1
             RETURNING equipment_id`,
            [taskId, userId, photos, notes, bonusEarned, kpiPoints, appliedMultiplier, overdueDaysAtCompletion, wasOverdue, responsibleUserIdAtCompletion]
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
        const hasCleaningIntervalOverrideColumn = await hasColumn('equipment', 'cleaning_interval_override_days');
        const effectiveCleaningIntervalSql = hasCleaningIntervalOverrideColumn
            ? `COALESCE(e.cleaning_interval_override_days, e.cleaning_interval_days)`
            : `e.cleaning_interval_days`;

        const equipmentRes = await query(
            `SELECT 
                ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                e.maintenance_enabled,
                CASE
                    WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                    WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                    ELSE COALESCE(w.assigned_user_id, z.assigned_user_id)
                END as effective_assigned_user_id
             FROM equipment e
             LEFT JOIN club_workstations w ON w.id = e.workstation_id
             LEFT JOIN club_zones z ON z.club_id = e.club_id AND z.name = w.zone
             WHERE e.id = $1`,
            [equipmentId]
        );
        
        const equipment = equipmentRes.rows[0];
        
        const clubRes = await query(
            `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone
             FROM clubs
             WHERE id = $1`,
            [clubId]
        );
        const clubTimezone = clubRes.rows[0]?.timezone || 'Europe/Moscow';

        // 4. Create next task if interval is set
        if (equipment && equipment.maintenance_enabled !== false) {
             const rawInterval = equipment.cleaning_interval_days;
             const intervalDays = Math.max(1, rawInterval || 30);
             
             const nextDueDate = parseDateKey(formatDateKeyInTimezone(new Date(), clubTimezone));
             nextDueDate.setDate(nextDueDate.getDate() + intervalDays);
             const nextDueDateStr = formatDateKeyInTimezone(nextDueDate, clubTimezone);
             
             // Find shift for assigned user if any AND user is active
             let finalDate = nextDueDateStr;
             let finalAssignedUserId = equipment.effective_assigned_user_id;
             
             if (finalAssignedUserId) {
                 // Check if user is active first
                 const userActiveRes = await query(
                     `SELECT is_active FROM club_employees WHERE club_id = $1 AND user_id = $2`,
                     [clubId, finalAssignedUserId]
                 );
                 
                 const isActive = userActiveRes.rows[0]?.is_active !== false;

                 if (isActive) {
                     // Simple shift lookup - get next working day >= nextDueDateStr
                     const shiftRes = await query(
                         `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
                          FROM work_schedules 
                          WHERE club_id = $1 AND user_id = $2 AND date >= $3
                          ORDER BY date ASC LIMIT 1`,
                         [clubId, finalAssignedUserId, nextDueDateStr]
                     );
                     if (shiftRes.rowCount && shiftRes.rowCount > 0) {
                         finalDate = String(shiftRes.rows[0].date);
                     }
                 } else {
                     finalAssignedUserId = null;
                 }
             }

             // CLEANUP: Delete any other PENDING tasks for this equipment to ensure "Smart Horizon"
             // This removes "ghost" tasks that might have incorrect dates (like 31.01)
             await query(
                 `DELETE FROM equipment_maintenance_tasks 
                  WHERE equipment_id = $1 
                    AND task_type = 'CLEANING'
                    AND status IN ('PENDING', 'IN_PROGRESS')
                    AND id != $2`,
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
                 [equipmentId, finalDate, finalAssignedUserId]
             );
        }

        return NextResponse.json({
            success: true,
            overdue_record: {
                was_overdue: wasOverdue,
                overdue_days_at_completion: overdueDaysAtCompletion,
                estimated_penalty: overduePenaltyPreview.total
            }
        });
    } catch (error) {
        console.error('Complete Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
