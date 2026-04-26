import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';
import { calculateMaintenanceOverduePenalty } from '@/lib/maintenance-penalties';
import { appendMaintenanceTaskEvent, ensureMaintenanceTaskInitialHistory, getMaintenanceTaskCurrentCycle } from '@/lib/maintenance-task-events';
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
        const photosRaw = body.photos;
        const photos = Array.isArray(photosRaw) ? photosRaw : null;
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

        const taskHistorySnapshotRes = await query(
            `SELECT id, verification_status, completed_at, completed_by, verified_at, verified_by, rejection_reason, verification_note, notes, photos
             FROM equipment_maintenance_tasks
             WHERE id = $1`,
            [taskId]
        );
        const currentTaskSnapshot = taskHistorySnapshotRes.rows[0];

        if (!currentTaskSnapshot) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        try {
            const settingsRes = await query(
                `SELECT require_photos_on_completion, min_photos, require_notes_on_completion
                 FROM club_maintenance_settings
                 WHERE club_id = $1`,
                [clubId]
            );
            const settingsRow = settingsRes.rows[0] || null;
            const requirePhotos = settingsRow?.require_photos_on_completion !== false;
            const minPhotos = requirePhotos ? Math.max(1, Number(settingsRow?.min_photos) || 1) : 0;
            const requireNotes = settingsRow?.require_notes_on_completion === true;

            if (minPhotos > 0) {
                const photoCount = Array.isArray(photosRaw) ? photosRaw.length : 0;
                if (photoCount < minPhotos) {
                    return NextResponse.json(
                        { error: `Нужно приложить минимум фото: ${minPhotos}` },
                        { status: 400 }
                    );
                }
            }

            if (requireNotes) {
                const noteStr = String(notes || '').trim();
                if (!noteStr) {
                    return NextResponse.json(
                        { error: 'Нужно заполнить комментарий к выполнению' },
                        { status: 400 }
                    );
                }
            }
        } catch (e) {
            const requirePhotos = true;
            const minPhotos = 1;
            if (requirePhotos) {
                const photoCount = Array.isArray(photosRaw) ? photosRaw.length : 0;
                if (photoCount < minPhotos) {
                    return NextResponse.json(
                        { error: `Нужно приложить минимум фото: ${minPhotos}` },
                        { status: 400 }
                    );
                }
            }
        }

        await ensureMaintenanceTaskInitialHistory(currentTaskSnapshot);
        const currentCycle = await getMaintenanceTaskCurrentCycle(taskId);
        const isResubmission = currentTaskSnapshot.verification_status === 'REJECTED';
        const nextCycle = isResubmission ? currentCycle + 1 : Math.max(currentCycle, 1);

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
                 verified_at = NULL,
                 verified_by = NULL,
                 verification_note = NULL,
                 rejection_reason = NULL,
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

        await appendMaintenanceTaskEvent({
            taskId,
            cycleNo: nextCycle,
            eventType: isResubmission ? 'RESUBMITTED' : 'SUBMITTED',
            actorUserId: userId,
            taskNotes: notes,
            photos,
        });

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

        await query(
            `UPDATE equipment e
             SET assigned_user_id = w.assigned_user_id,
                 assignment_mode = CASE
                     WHEN w.assigned_user_id IS NULL THEN 'FREE_POOL'
                     ELSE 'DIRECT'
                 END
             FROM club_workstations w
             WHERE e.id = $1
               AND e.assignment_mode = 'INHERIT'
               AND e.workstation_id = w.id`,
            [equipmentId]
        );
        await query(
            `UPDATE equipment
             SET assigned_user_id = NULL,
                 assignment_mode = 'FREE_POOL'
             WHERE id = $1
               AND assignment_mode = 'INHERIT'
               AND workstation_id IS NULL`,
            [equipmentId]
        );

        const equipmentRes = await query(
            `SELECT 
                ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                e.maintenance_enabled,
                CASE
                    WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                    ELSE NULL
                END as effective_assigned_user_id
             FROM equipment e
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
                 // Keep next task only on users that are valid for maintenance assignment.
                 const userActiveRes = await query(
                     `WITH member_rows AS (
                         SELECT ce.user_id, ce.role, ce.is_active, ce.dismissed_at, ce.show_in_schedule, 0 as priority
                         FROM club_employees ce
                         WHERE ce.club_id = $1
                         UNION ALL
                         SELECT c.owner_id as user_id, 'Владелец'::varchar as role, TRUE as is_active, NULL::timestamp as dismissed_at, TRUE as show_in_schedule, 1 as priority
                         FROM clubs c
                         WHERE c.id = $1
                      ),
                      dedup_members AS (
                         SELECT DISTINCT ON (user_id) user_id, role, is_active, dismissed_at, show_in_schedule
                         FROM member_rows
                         ORDER BY user_id, priority DESC
                      )
                      SELECT 1
                      FROM dedup_members
                      WHERE user_id = $2
                        AND is_active = TRUE
                        AND dismissed_at IS NULL
                        AND (
                            show_in_schedule = TRUE
                            OR LOWER(COALESCE(role, '')) LIKE '%управ%'
                            OR LOWER(COALESCE(role, '')) LIKE '%manager%'
                        )
                      LIMIT 1`,
                     [clubId, finalAssignedUserId]
                 );
                 const isActive = (userActiveRes.rowCount || 0) > 0;

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
