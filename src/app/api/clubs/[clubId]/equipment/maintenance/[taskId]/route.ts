import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';
import { hasColumn } from '@/lib/db-compat';
import { calculateMaintenanceOverduePenalty } from '@/lib/maintenance-penalties';
import { formatDateKeyInTimezone, parseDateKey } from '@/lib/utils';

// PATCH - Update/complete maintenance task
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ clubId: string; taskId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, taskId } = await params;
        const body = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify access
        const accessCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
            [clubId, userId]
        );

        if ((accessCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Verify task belongs to club
        const taskCheck = await query(
            `SELECT mt.*, e.id as equipment_id 
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             WHERE mt.id = $1 AND e.club_id = $2`,
            [taskId, clubId]
        );

        if ((taskCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const { status, assigned_user_id, notes, claim } = body;
        const task = taskCheck.rows[0];

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        // "Claim" action - employee takes the task
        if (claim === true) {
            updates.push(`assigned_user_id = $${paramIndex}`);
            values.push(userId);
            paramIndex++;

            updates.push(`status = 'IN_PROGRESS'`);
        } else {
            if (status !== undefined) {
                updates.push(`status = $${paramIndex}`);
                values.push(status);
                paramIndex++;

                // If completing, set completed_by, completed_at, and update equipment's last_cleaned_at
                if (status === 'COMPLETED') {
                    updates.push(`completed_by = $${paramIndex}`);
                    values.push(userId);
                    paramIndex++;

                    updates.push(`completed_at = CURRENT_TIMESTAMP`);

                    // Also update equipment's last_cleaned_at if this is a cleaning task
                    if (task.task_type === 'CLEANING') {
                        await query(
                            `UPDATE equipment SET last_cleaned_at = CURRENT_TIMESTAMP WHERE id = $1`,
                            [task.equipment_id]
                        );
                    }

                    // Calculate KPI bonus
                    const kpiConfig = await query(
                        `SELECT * FROM maintenance_kpi_config WHERE club_id = $1`,
                        [clubId]
                    );

                    const config = kpiConfig.rows[0];
                    const overdueDaysAtCompletion = Math.max(0, Math.floor(
                        (new Date(new Date().toDateString()).getTime() - new Date(new Date(task.due_date).toDateString()).getTime()) / (1000 * 60 * 60 * 24)
                    ));
                    const wasOverdue = overdueDaysAtCompletion > 0;
                    const responsibleUserIdAtCompletion = task.assigned_user_id || userId;

                    if (config?.enabled) {
                        // Penalties removed as per request
                        const multiplier = 1.0;

                        const points = task.kpi_points || config.points_per_cleaning || 1;
                        let bonus = points * parseFloat(config.bonus_per_point) * multiplier;

                        // If using monthly tiered calculation, we don't pay per task immediately
                        if (config.calculation_mode === 'MONTHLY_TIERS') {
                            bonus = 0;
                        }

                        updates.push(`bonus_earned = $${paramIndex}`);
                        values.push(bonus);
                        paramIndex++;

                        const overduePenaltyPreview = calculateMaintenanceOverduePenalty(
                            {
                                overdue_tolerance_days: config.overdue_tolerance_days,
                                late_penalty_multiplier: config.late_penalty_multiplier
                            },
                            [{ overdue_days_at_completion: overdueDaysAtCompletion, bonus_earned: bonus, was_overdue: wasOverdue }]
                        );
                        console.log(`[Maintenance] Overdue penalty preview for task ${taskId}: ${overduePenaltyPreview.total}`);
                    }

                    updates.push(`overdue_days_at_completion = $${paramIndex}`);
                    values.push(overdueDaysAtCompletion);
                    paramIndex++;

                    updates.push(`was_overdue = $${paramIndex}`);
                    values.push(wasOverdue);
                    paramIndex++;

                    updates.push(`responsible_user_id_at_completion = $${paramIndex}`);
                    values.push(responsibleUserIdAtCompletion);
                    paramIndex++;

                    const clubRes = await query(
                        `SELECT COALESCE(timezone, 'Europe/Moscow') as timezone
                         FROM clubs
                         WHERE id = $1`,
                        [clubId]
                    );
                    const clubTimezone = clubRes.rows[0]?.timezone || 'Europe/Moscow';

                    // AUTO-SCHEDULE NEXT TASK
                    // Find equipment and calculate next due date
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
                           AND e.club_id = $2
                           AND e.assignment_mode = 'INHERIT'
                           AND e.workstation_id = w.id`,
                        [task.equipment_id, clubId]
                    );
                    await query(
                        `UPDATE equipment
                         SET assigned_user_id = NULL,
                             assignment_mode = 'FREE_POOL'
                         WHERE id = $1
                           AND club_id = $2
                           AND assignment_mode = 'INHERIT'
                           AND workstation_id IS NULL`,
                        [task.equipment_id, clubId]
                    );

                    const eqRes = await query(
                        `SELECT 
                            ${effectiveCleaningIntervalSql} as cleaning_interval_days,
                            e.maintenance_enabled,
                            CASE
                                WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                                ELSE NULL
                            END as effective_assigned_user_id
                         FROM equipment e
                         WHERE e.id = $1`,
                        [task.equipment_id]
                    );
                    
                    if (eqRes.rowCount && eqRes.rowCount > 0) {
                        const eq = eqRes.rows[0];
                        if (eq.maintenance_enabled !== false) {
                            const rawInterval = eq.cleaning_interval_days;
                            const intervalDays = Math.max(1, rawInterval || 30);
                            
                            console.log(`[Maintenance] Completing task ${taskId}. Equipment ${task.equipment_id}. Raw Interval: ${rawInterval}, Used: ${intervalDays}`);
                            
                            const nextDue = parseDateKey(formatDateKeyInTimezone(new Date(), clubTimezone));
                            nextDue.setDate(nextDue.getDate() + intervalDays);
                            
                            console.log(`[Maintenance] Next Due Initial: ${nextDue.toISOString()}`);

                            // Ensure nextDue is at least tomorrow
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            if (nextDue < tomorrow && intervalDays > 0) {
                                // Logic preserved from previous edit, though redundant if interval >= 1
                            }

                            const nextDueStr = formatDateKeyInTimezone(nextDue, clubTimezone);
                            console.log(`[Maintenance] Next Due String: ${nextDueStr}`);
                            
                            // Find shift for assigned user if any AND user is active
                            let finalDate = nextDueStr;
                            let finalAssignedUserId = eq.effective_assigned_user_id;
                            
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
                                    console.log(`[Maintenance] Checking shifts for active user ${finalAssignedUserId} starting from ${nextDueStr}`);
                                    // Simple shift lookup - get next working day >= nextDueStr
                                    const shiftRes = await query(
                                        `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
                                         FROM work_schedules 
                                         WHERE club_id = $1 AND user_id = $2 AND date >= $3
                                         ORDER BY date ASC LIMIT 1`,
                                        [clubId, finalAssignedUserId, nextDueStr]
                                    );
                                    if (shiftRes.rowCount && shiftRes.rowCount > 0) {
                                        finalDate = String(shiftRes.rows[0].date);
                                        console.log(`[Maintenance] Found shift: ${finalDate}`);
                                    } else {
                                        console.log(`[Maintenance] No shift found, keeping ${finalDate}`);
                                    }
                                } else {
                                    console.log(`[Maintenance] User ${finalAssignedUserId} is inactive, unassigning next task`);
                                    finalAssignedUserId = null;
                                }
                            }

                            await query(
                                `DELETE FROM equipment_maintenance_tasks
                                 WHERE equipment_id = $1
                                   AND task_type = $2
                                   AND status IN ('PENDING', 'IN_PROGRESS')
                                   AND id != $3`,
                                [task.equipment_id, task.task_type, taskId]
                            );

                            const insertRes = await query(
                                `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date, assigned_user_id)
                                 VALUES ($1, $2, $3, $4)
                                 ON CONFLICT DO NOTHING
                                 RETURNING id`,
                                [task.equipment_id, task.task_type, finalDate, finalAssignedUserId]
                            );
                            console.log(`[Maintenance] Created task: ${insertRes.rows[0]?.id || 'CONFLICT'}`);
                        }
                    }
                }
            }

            if (assigned_user_id !== undefined) {
                updates.push(`assigned_user_id = $${paramIndex}`);
                values.push(assigned_user_id === '' ? null : assigned_user_id);
                paramIndex++;
            }

            if (notes !== undefined) {
                updates.push(`notes = $${paramIndex}`);
                values.push(notes);
                paramIndex++;
            }
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(taskId);

        const result = await query(
            `UPDATE equipment_maintenance_tasks 
             SET ${updates.join(', ')}
             WHERE id = $${paramIndex}
             RETURNING *`,
            values
        );

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Update Maintenance Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE - Delete maintenance task
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string; taskId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value;
        const { clubId, taskId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify ownership
        const ownerCheck = await query(
            `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
            [clubId, userId]
        );

        if ((ownerCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Get task details before deletion to update equipment status if needed
        const taskCheck = await query(
            `SELECT mt.equipment_id, mt.task_type, mt.status 
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             WHERE mt.id = $1 AND e.club_id = $2`,
            [taskId, clubId]
        );

        if ((taskCheck.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const task = taskCheck.rows[0];

        const result = await query(
            `DELETE FROM equipment_maintenance_tasks
             WHERE id = $1
             RETURNING id`,
            [taskId]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // If we deleted a COMPLETED CLEANING task, we need to revert/update the last_cleaned_at date
        // to the date of the most recent completed task remaining.
        if (task.task_type === 'CLEANING' && task.status === 'COMPLETED') {
            const lastCleanedRes = await query(
                `SELECT completed_at 
                 FROM equipment_maintenance_tasks 
                 WHERE equipment_id = $1 
                   AND task_type = 'CLEANING' 
                   AND status = 'COMPLETED'
                 ORDER BY completed_at DESC 
                 LIMIT 1`,
                [task.equipment_id]
            );

            const newLastCleaned = lastCleanedRes.rows[0]?.completed_at || null;

            await query(
                `UPDATE equipment SET last_cleaned_at = $1 WHERE id = $2`,
                [newLastCleaned, task.equipment_id]
            );
        }

        // CLEANUP: Delete any other PENDING tasks for this equipment to remove ghosts
        await query(
            `DELETE FROM equipment_maintenance_tasks 
             WHERE equipment_id = $1 AND status = 'PENDING' AND id != $2`,
            [task.equipment_id, taskId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Maintenance Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
