import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { hasColumn } from "@/lib/db-compat";
import { calculateMaintenanceOverduePenalty } from "@/lib/maintenance-penalties";
import { formatDateKeyInTimezone, parseDateKey } from "@/lib/utils";

// GET - Retrieve single task details, including equipment, instructions, settings, and rework rejection history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access
    const accessCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveEquipmentAssigneeSql = `
      CASE
        WHEN e.assignment_mode = 'DIRECT' AND ce_equip.is_active = TRUE THEN e.assigned_user_id
        ELSE NULL
      END
    `;

    const effectiveTaskAssigneeSql = `
      CASE
        WHEN mt.assigned_user_id IS NOT NULL AND ce_task.is_active = TRUE AND (
          mt.verification_status = 'REJECTED'
          OR mt.session_id IS NOT NULL
          OR ce_task.role_id IN (2, 5142)
          OR mt.updated_at > NOW() - INTERVAL '2 hours'
          OR EXISTS (
            SELECT 1 FROM shifts s_active
            WHERE s_active.user_id = mt.assigned_user_id
              AND s_active.club_id = e.club_id
              AND s_active.check_out IS NULL
          )
        ) THEN mt.assigned_user_id
        ELSE ${effectiveEquipmentAssigneeSql}
      END
    `;

    const effectiveStatusSql = `
      CASE
        WHEN mt.status = 'IN_PROGRESS' AND (
          mt.assigned_user_id IS NOT NULL AND (
            ce_task.is_active = FALSE
            OR (
              mt.session_id IS NULL
              AND COALESCE(ce_task.role_id, 0) NOT IN (2, 5142)
              AND mt.updated_at <= NOW() - INTERVAL '2 hours'
              AND NOT EXISTS (
                SELECT 1 FROM shifts s_active
                WHERE s_active.user_id = mt.assigned_user_id
                  AND s_active.club_id = e.club_id
                  AND s_active.check_out IS NULL
              )
            )
          )
        ) THEN
          CASE WHEN mt.verification_status = 'REJECTED' THEN 'REWORK' ELSE 'PENDING' END
        ELSE mt.status
      END
    `;

    // Fetch the task and joined equipment / workstation info
    const taskRes = await query(
      `SELECT 
        mt.id, 
        ${effectiveStatusSql} as status, 
        mt.task_type, mt.due_date, 
        ${effectiveTaskAssigneeSql} as assigned_user_id, 
        mt.notes,
        mt.kpi_points, mt.photos_before, mt.photos_after,
        e.id as equipment_id, e.name as equipment_name, e.type as equipment_type,
        e.identifier as equipment_identifier, e.brand as equipment_brand, e.model as equipment_model,
        w.name as workstation_name, w.id as workstation_id,
        inst.instructions, inst.performance_instructions,
        -- Fetch the latest event of type REJECTED to show rejection/rework reason if status is REWORK
        (
          SELECT note 
          FROM equipment_maintenance_task_events 
          WHERE task_id = mt.id AND event_type = 'REJECTED' 
          ORDER BY created_at DESC LIMIT 1
        ) as rejection_reason
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       LEFT JOIN club_equipment_instructions inst ON inst.club_id = mt.club_id AND inst.equipment_type_code = e.type
       LEFT JOIN club_employees ce_task ON ce_task.user_id = mt.assigned_user_id AND ce_task.club_id = e.club_id
       LEFT JOIN club_employees ce_equip ON ce_equip.user_id = e.assigned_user_id AND ce_equip.club_id = e.club_id
       WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );

    if ((taskRes.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskRes.rows[0];

    // Fetch maintenance settings for this club
    const settingsRes = await query(
      `SELECT 
        require_photo_before, min_photos_before,
        require_photo_after, min_photos_after,
        require_notes_on_completion, block_desktop_access,
        instruction_step_order, desktop_completion_mode
       FROM club_maintenance_settings
       WHERE club_id = $1`,
      [clubId],
    );

    const settings = settingsRes.rows[0] || {
      require_photo_before: false,
      min_photos_before: 0,
      require_photo_after: true,
      min_photos_after: 1,
      require_notes_on_completion: false,
      block_desktop_access: false,
      instruction_step_order: "BEFORE_PHOTOS",
      desktop_completion_mode: "QR",
    };

    return NextResponse.json({
      task: {
        id: task.id,
        status: task.status,
        task_type: task.task_type,
        due_date: task.due_date,
        assigned_user_id: task.assigned_user_id,
        notes: task.notes,
        kpi_points: task.kpi_points,
        performance_data: null,
        photos_before: task.photos_before || [],
        photos_after: task.photos_after || [],
        rejection_reason: task.rejection_reason,
      },
      equipment: {
        id: task.equipment_id,
        name: task.equipment_name,
        type: task.equipment_type,
        identifier: task.equipment_identifier,
        brand: task.equipment_brand,
        model: task.equipment_model,
        workstation_name: task.workstation_name,
        workstation_id: task.workstation_id,
      },
      instructions: {
        instructions: task.instructions || "",
        performance_instructions: task.performance_instructions || "",
      },
      settings: {
        require_photo_before: settings.require_photo_before === true,
        min_photos_before: Math.max(0, Number(settings.min_photos_before) || 0),
        require_photo_after: settings.require_photo_after !== false,
        min_photos_after: Math.max(0, Number(settings.min_photos_after) || 0),
        require_notes_on_completion: settings.require_notes_on_completion === true,
        block_desktop_access: settings.block_desktop_access === true,
        instruction_step_order: settings.instruction_step_order || "BEFORE_PHOTOS",
        desktop_completion_mode: settings.desktop_completion_mode || "QR",
      }
    });
  } catch (error) {
    console.error("Get Maintenance Task Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// PATCH - Update/complete maintenance task
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;
    const body = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access
    const accessCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2
             UNION
             SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify task belongs to club and get effective assignment info
    const taskCheck = await query(
      `SELECT mt.*, e.id as equipment_id,
              CASE 
                WHEN e.assignment_mode = 'DIRECT' THEN 'DIRECT'
                WHEN e.assignment_mode = 'FREE_POOL' THEN 'FREE_POOL'
                WHEN e.assignment_mode = 'INHERIT' THEN
                  CASE WHEN w.assigned_user_id IS NOT NULL THEN 'DIRECT' ELSE 'FREE_POOL' END
                ELSE 'FREE_POOL'
              END as effective_assignment_mode,
              CASE 
                WHEN e.assignment_mode = 'DIRECT' THEN e.assigned_user_id
                WHEN e.assignment_mode = 'FREE_POOL' THEN NULL
                WHEN e.assignment_mode = 'INHERIT' THEN w.assigned_user_id
                ELSE NULL
              END as effective_assigned_user_id,
              CASE
                WHEN mt.assigned_user_id IS NOT NULL AND ce_task.is_active = TRUE AND (
                  mt.verification_status = 'REJECTED'
                  OR mt.session_id IS NOT NULL
                  OR ce_task.role_id IN (2, 5142)
                  OR mt.updated_at > NOW() - INTERVAL '2 hours'
                  OR EXISTS (
                    SELECT 1 FROM shifts s_active
                    WHERE s_active.user_id = mt.assigned_user_id
                      AND s_active.club_id = e.club_id
                      AND s_active.check_out IS NULL
                  )
                ) THEN mt.assigned_user_id
                ELSE CASE
                  WHEN e.assignment_mode = 'DIRECT' AND ce_equip.is_active = TRUE THEN e.assigned_user_id
                  ELSE NULL
                END
              END as effective_task_assigned_user_id
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_workstations w ON e.workstation_id = w.id
       LEFT JOIN club_employees ce_task ON ce_task.user_id = mt.assigned_user_id AND ce_task.club_id = e.club_id
       LEFT JOIN club_employees ce_equip ON ce_equip.user_id = e.assigned_user_id AND ce_equip.club_id = e.club_id
       WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );

    if ((taskCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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

        if (status === "PENDING") {
          updates.push(`session_id = NULL`);
          if (assigned_user_id === undefined) {
            if (task.effective_assignment_mode === "FREE_POOL") {
              updates.push(`assigned_user_id = NULL`);
            } else if (task.effective_assignment_mode === "DIRECT") {
              updates.push(`assigned_user_id = $${paramIndex}`);
              values.push(task.effective_assigned_user_id);
              paramIndex++;
            }
          }
        }

        // If completing, set completed_by, completed_at, and update equipment's last_cleaned_at
        if (status === "COMPLETED") {
          updates.push(`completed_by = $${paramIndex}`);
          values.push(userId);
          paramIndex++;

          updates.push(`completed_at = CURRENT_TIMESTAMP`);

          updates.push(`assigned_user_id = $${paramIndex}`);
          values.push(userId);
          paramIndex++;

          // Also update equipment's last_cleaned_at if this is a cleaning task
          if (task.task_type === "CLEANING") {
            await query(
              `UPDATE equipment SET last_cleaned_at = CURRENT_TIMESTAMP WHERE id = $1`,
              [task.equipment_id],
            );
          }

          // Calculate KPI bonus
          const kpiConfig = await query(
            `SELECT * FROM maintenance_kpi_config WHERE club_id = $1`,
            [clubId],
          );

          const config = kpiConfig.rows[0];
          const overdueDaysAtCompletion = Math.max(
            0,
            Math.floor(
              (new Date(new Date().toDateString()).getTime() -
                new Date(new Date(task.due_date).toDateString()).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          );
          const wasOverdue = overdueDaysAtCompletion > 0;
          const responsibleUserIdAtCompletion = task.effective_task_assigned_user_id || userId;

          if (config?.enabled) {
            // Penalties removed as per request
            const multiplier = 1.0;

            const points = task.kpi_points || config.points_per_cleaning || 1;
            let bonus =
              points * parseFloat(config.bonus_per_point) * multiplier;

            // If using monthly tiered calculation, we don't pay per task immediately
            if (config.calculation_mode === "MONTHLY_TIERS") {
              bonus = 0;
            }

            updates.push(`bonus_earned = $${paramIndex}`);
            values.push(bonus);
            paramIndex++;

            const overduePenaltyPreview = calculateMaintenanceOverduePenalty(
              {
                overdue_tolerance_days: config.overdue_tolerance_days,
                late_penalty_multiplier: config.late_penalty_multiplier,
              },
              [
                {
                  overdue_days_at_completion: overdueDaysAtCompletion,
                  bonus_earned: bonus,
                  was_overdue: wasOverdue,
                },
              ],
            );
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
            [clubId],
          );
          const clubTimezone = clubRes.rows[0]?.timezone || "Europe/Moscow";

          // AUTO-SCHEDULE NEXT TASK
          // Find equipment and calculate next due date
          const hasCleaningIntervalOverrideColumn = await hasColumn(
            "equipment",
            "cleaning_interval_override_days",
          );
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
            [task.equipment_id, clubId],
          );
          await query(
            `UPDATE equipment
                         SET assigned_user_id = NULL,
                             assignment_mode = 'FREE_POOL'
                         WHERE id = $1
                           AND club_id = $2
                           AND assignment_mode = 'INHERIT'
                           AND workstation_id IS NULL`,
            [task.equipment_id, clubId],
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
            [task.equipment_id],
          );

          if (eqRes.rowCount && eqRes.rowCount > 0) {
            const eq = eqRes.rows[0];
            if (eq.maintenance_enabled !== false) {
              const rawInterval = eq.cleaning_interval_days;
              const intervalDays = Math.max(1, rawInterval || 30);

              const nextDue = parseDateKey(
                formatDateKeyInTimezone(new Date(), clubTimezone),
              );
              nextDue.setDate(nextDue.getDate() + intervalDays);

              // Ensure nextDue is at least tomorrow
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              if (nextDue < tomorrow && intervalDays > 0) {
                // Logic preserved from previous edit, though redundant if interval >= 1
              }

              const nextDueStr = formatDateKeyInTimezone(nextDue, clubTimezone);

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
                  [clubId, finalAssignedUserId],
                );
                const isActive = (userActiveRes.rowCount || 0) > 0;

                if (isActive) {
                  // Simple shift lookup - get next working day >= nextDueStr
                  const shiftRes = await query(
                    `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
                                         FROM work_schedules
                                         WHERE club_id = $1 AND user_id = $2 AND date >= $3
                                         ORDER BY date ASC LIMIT 1`,
                    [clubId, finalAssignedUserId, nextDueStr],
                  );
                  if (shiftRes.rowCount && shiftRes.rowCount > 0) {
                    finalDate = String(shiftRes.rows[0].date);
                  } else {
                  }
                } else {
                  finalAssignedUserId = null;
                }
              }

              await query(
                `DELETE FROM equipment_maintenance_tasks
                                 WHERE equipment_id = $1
                                   AND task_type = $2
                                   AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
                                   AND id != $3`,
                [task.equipment_id, task.task_type, taskId],
              );

              const insertRes = await query(
                `INSERT INTO equipment_maintenance_tasks (club_id, equipment_id, task_type, due_date, assigned_user_id, created_by)
                                 VALUES ($1, $2, $3, $4, $5, $6)
                                 ON CONFLICT DO NOTHING
                                 RETURNING id`,
                [
                  clubId,
                  task.equipment_id,
                  task.task_type,
                  finalDate,
                  finalAssignedUserId,
                  userId,
                ],
              );
            }
          }
        }
      }

      if (assigned_user_id !== undefined && status !== "COMPLETED") {
        updates.push(`assigned_user_id = $${paramIndex}`);
        values.push(assigned_user_id === "" ? null : assigned_user_id);
        paramIndex++;
      }

      if (notes !== undefined) {
        updates.push(`notes = $${paramIndex}`);
        values.push(notes);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    values.push(taskId);

    const result = await query(
      `UPDATE equipment_maintenance_tasks
             SET ${updates.join(", ")}
             WHERE id = $${paramIndex}
             RETURNING *`,
      values,
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Update Maintenance Task Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// DELETE - Delete maintenance task
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const ownerCheck = await query(
      `SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
      [clubId, userId],
    );

    if ((ownerCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get task details before deletion to update equipment status if needed
    const taskCheck = await query(
      `SELECT mt.equipment_id, mt.task_type, mt.status
             FROM equipment_maintenance_tasks mt
             JOIN equipment e ON mt.equipment_id = e.id
             WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );

    if ((taskCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = taskCheck.rows[0];

    const result = await query(
      `DELETE FROM equipment_maintenance_tasks
             WHERE id = $1
             RETURNING id`,
      [taskId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // If we deleted a COMPLETED CLEANING task, we need to revert/update the last_cleaned_at date
    // to the date of the most recent completed task remaining.
    if (task.task_type === "CLEANING" && task.status === "COMPLETED") {
      const lastCleanedRes = await query(
        `SELECT completed_at
                 FROM equipment_maintenance_tasks
                 WHERE equipment_id = $1
                   AND task_type = 'CLEANING'
                   AND status = 'COMPLETED'
                 ORDER BY completed_at DESC
                 LIMIT 1`,
        [task.equipment_id],
      );

      const newLastCleaned = lastCleanedRes.rows[0]?.completed_at || null;

      await query(`UPDATE equipment SET last_cleaned_at = $1 WHERE id = $2`, [
        newLastCleaned,
        task.equipment_id,
      ]);
    }

    // CLEANUP: Delete any other PENDING tasks for this equipment to remove ghosts
    await query(
      `DELETE FROM equipment_maintenance_tasks
             WHERE equipment_id = $1 AND status = 'PENDING' AND id != $2`,
      [task.equipment_id, taskId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Maintenance Task Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
