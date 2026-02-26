import { NextResponse } from 'next/server';
import { query } from '@/db';
import { cookies } from 'next/headers';

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
                    if (config?.enabled) {
                        const dueDate = new Date(task.due_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        const isOnTime = today <= dueDate;
                        const multiplier = isOnTime ?
                            parseFloat(config.on_time_multiplier) :
                            parseFloat(config.late_penalty_multiplier);

                        const points = task.kpi_points || config.points_per_cleaning || 1;
                        const bonus = points * parseFloat(config.bonus_per_point) * multiplier;

                        updates.push(`bonus_earned = $${paramIndex}`);
                        values.push(bonus);
                        paramIndex++;
                    }

                    if (config?.enabled && task.assigned_user_id) {
                        const dueDate = new Date(task.due_date);
                        const year = dueDate.getFullYear();
                        const month = dueDate.getMonth() + 1;
                        const monthStr = month.toString().padStart(2, '0');
                        const monthStart = `${year}-${monthStr}-01`;
                        const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

                        const remaining = await query(
                            `SELECT 1 FROM equipment_maintenance_tasks mt
                             JOIN equipment e ON mt.equipment_id = e.id
                             WHERE e.club_id = $1 AND mt.assigned_user_id = $2
                               AND mt.status != 'COMPLETED'
                               AND mt.due_date >= $3 AND mt.due_date <= $4
                             LIMIT 1`,
                            [clubId, task.assigned_user_id, monthStart, monthEnd]
                        );

                        if ((remaining.rowCount || 0) === 0) {
                            const monthlyBonus = parseFloat(config.bonus_per_point) * (config.points_per_cleaning || 1);
                            if (monthlyBonus > 0) {
                                await query(
                                    `INSERT INTO maintenance_monthly_bonuses (club_id, user_id, year, month, bonus_amount)
                                     VALUES ($1, $2, $3, $4, $5)
                                     ON CONFLICT (club_id, user_id, year, month) DO NOTHING`,
                                    [clubId, task.assigned_user_id, year, month, monthlyBonus]
                                );
                            }
                        }
                    }

                    // AUTO-SCHEDULE NEXT TASK
                    // Find equipment and calculate next due date
                    const eqRes = await query(
                        `SELECT cleaning_interval_days, assigned_user_id, workstation_id, maintenance_enabled
                         FROM equipment WHERE id = $1`,
                        [task.equipment_id]
                    );
                    
                    if (eqRes.rowCount && eqRes.rowCount > 0) {
                        const eq = eqRes.rows[0];
                        if (eq.maintenance_enabled !== false) {
                            const rawInterval = eq.cleaning_interval_days;
                            const intervalDays = Math.max(1, rawInterval || 30);
                            
                            console.log(`[Maintenance] Completing task ${taskId}. Equipment ${task.equipment_id}. Raw Interval: ${rawInterval}, Used: ${intervalDays}`);
                            
                            const nextDue = new Date(); // Start from completion time (now)
                            nextDue.setDate(nextDue.getDate() + intervalDays);
                            
                            console.log(`[Maintenance] Next Due Initial: ${nextDue.toISOString()}`);

                            // Ensure nextDue is at least tomorrow
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            if (nextDue < tomorrow && intervalDays > 0) {
                                // Logic preserved from previous edit, though redundant if interval >= 1
                            }

                            const nextDueStr = nextDue.toISOString().split('T')[0];
                            console.log(`[Maintenance] Next Due String: ${nextDueStr}`);
                            
                            // Find shift for assigned user if any
                            let finalDate = nextDueStr;
                            const assignedUserId = eq.assigned_user_id;
                            
                            if (assignedUserId) {
                                console.log(`[Maintenance] Checking shifts for user ${assignedUserId} starting from ${nextDueStr}`);
                                // Simple shift lookup - get next working day >= nextDueStr
                                const shiftRes = await query(
                                    `SELECT date FROM work_schedules 
                                     WHERE club_id = $1 AND user_id = $2 AND date >= $3
                                     ORDER BY date ASC LIMIT 1`,
                                    [clubId, assignedUserId, nextDueStr]
                                );
                                if (shiftRes.rowCount && shiftRes.rowCount > 0) {
                                    finalDate = shiftRes.rows[0].date;
                                    console.log(`[Maintenance] Found shift: ${finalDate}`);
                                } else {
                                    console.log(`[Maintenance] No shift found, keeping ${finalDate}`);
                                }
                            }

                            const insertRes = await query(
                                `INSERT INTO equipment_maintenance_tasks (equipment_id, task_type, due_date, assigned_user_id)
                                 VALUES ($1, $2, $3, $4)
                                 ON CONFLICT (equipment_id, due_date, task_type) DO NOTHING
                                 RETURNING id`,
                                [task.equipment_id, task.task_type, finalDate, assignedUserId]
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Maintenance Task Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
