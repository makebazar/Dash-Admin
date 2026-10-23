import { query } from "@/db";
import { calculateMaintenanceOverduePenalty } from "@/lib/maintenance-penalties";
import {
  appendMaintenanceTaskEvent,
  ensureMaintenanceTaskInitialHistory,
  getMaintenanceTaskCurrentCycle,
} from "@/lib/maintenance-task-events";
import { formatDateKeyInTimezone, isLaundryEquipmentType } from "@/lib/utils";

const isManagerRoleSql = (alias: string) => `
  (
    COALESCE(${alias}.role_id, 0) IN (2, 5142)
    OR LOWER(COALESCE(${alias}.role, '')) LIKE '%управ%'
    OR LOWER(COALESCE(${alias}.role, '')) LIKE '%manager%'
  )
`;

export const effectiveEquipmentAssigneeSql = `
  CASE
    WHEN e.assignment_mode = 'DIRECT'
         AND ce_equip.is_active = TRUE
         AND ce_equip.dismissed_at IS NULL
    THEN e.assigned_user_id
    ELSE NULL
  END
`;

export const effectiveTaskAssigneeSql = `
  CASE
    WHEN mt.assigned_user_id IS NOT NULL
         AND ce_task.is_active = TRUE
         AND ce_task.dismissed_at IS NULL
         AND (
           mt.verification_status = 'REJECTED'
           OR (
             mt.updated_at > NOW() - INTERVAL '12 hours'
             AND (
               mt.session_id IS NOT NULL
               OR ${isManagerRoleSql("ce_task")}
               OR mt.updated_at > NOW() - INTERVAL '2 hours'
               OR EXISTS (
                 SELECT 1 FROM shifts s_active
                 WHERE s_active.user_id = mt.assigned_user_id
                   AND s_active.club_id = e.club_id
                   AND s_active.check_out IS NULL
                   AND s_active.check_in > NOW() - INTERVAL '16 hours'
               )
             )
           )
         )
    THEN mt.assigned_user_id
    ELSE ${effectiveEquipmentAssigneeSql}
  END
`;

export const effectiveStatusSql = `
  CASE
    WHEN mt.status = 'IN_PROGRESS' AND (
      mt.assigned_user_id IS NULL
      OR ce_task.user_id IS NULL
      OR ce_task.is_active = FALSE
      OR ce_task.dismissed_at IS NOT NULL
      OR mt.updated_at <= NOW() - INTERVAL '12 hours'
      OR (
        mt.session_id IS NULL
        AND NOT ${isManagerRoleSql("ce_task")}
        AND mt.updated_at <= NOW() - INTERVAL '2 hours'
        AND NOT EXISTS (
          SELECT 1 FROM shifts s_active
          WHERE s_active.user_id = mt.assigned_user_id
            AND s_active.club_id = e.club_id
            AND s_active.check_out IS NULL
            AND s_active.check_in > NOW() - INTERVAL '16 hours'
        )
      )
    ) THEN
      CASE WHEN mt.verification_status = 'REJECTED' THEN 'REWORK' ELSE 'PENDING' END
    ELSE mt.status
  END
`;

export async function releaseClubEmployeeAssignments(
  clubId: string | number,
  employeeId: string,
) {
  await query(
    `UPDATE shifts
     SET check_out = NOW(),
         status = CASE WHEN status = 'ACTIVE' THEN 'CLOSED' ELSE status END
     WHERE club_id = $1 AND user_id = $2 AND check_out IS NULL`,
    [clubId, employeeId],
  );
  await query(
    `UPDATE club_zones SET assigned_user_id = NULL WHERE club_id = $1 AND assigned_user_id = $2`,
    [clubId, employeeId],
  );
  await query(
    `UPDATE club_workstations SET assigned_user_id = NULL WHERE club_id = $1 AND assigned_user_id = $2`,
    [clubId, employeeId],
  );
  await query(
    `UPDATE equipment
     SET assigned_user_id = NULL,
         assignment_mode = 'FREE_POOL',
         updated_at = CURRENT_TIMESTAMP
     WHERE club_id = $1 AND assigned_user_id = $2`,
    [clubId, employeeId],
  );
  await query(
    `UPDATE equipment_maintenance_tasks mt
     SET assigned_user_id = CASE
           WHEN e.assignment_mode = 'DIRECT'
                AND e.assigned_user_id IS NOT NULL
                AND e.assigned_user_id <> $2
                AND EXISTS (
                  SELECT 1 FROM club_employees ce
                  WHERE ce.club_id = e.club_id
                    AND ce.user_id = e.assigned_user_id
                    AND ce.is_active = TRUE
                    AND ce.dismissed_at IS NULL
                )
           THEN e.assigned_user_id
           ELSE NULL
         END,
         status = CASE
           WHEN mt.verification_status = 'REJECTED' THEN 'REWORK'
           ELSE 'PENDING'
         END,
         session_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     FROM equipment e
     WHERE mt.equipment_id = e.id
       AND e.club_id = $1
       AND mt.assigned_user_id = $2
       AND mt.status IN ('PENDING', 'IN_PROGRESS', 'REWORK')`,
    [clubId, employeeId],
  );
}

export async function completeMaintenanceTask(params: {
  clubId: string;
  taskId: string;
  userId: string;
  photos_before?: string[];
  photos_after?: string[];
  notes?: string | null;
  status_mode?: "OK" | "ISSUE" | "LAUNDRY" | "SKIPPED";
  issue_title?: string | null;
  issue_description?: string | null;
  performance_data?: Record<string, string>;
}) {
  const {
    clubId,
    taskId,
    userId,
    photos_before = [],
    photos_after = [],
    notes,
    status_mode = "OK",
    issue_title,
    issue_description,
    performance_data,
  } = params;

  if (status_mode === "SKIPPED") {
    // 1. Get task snapshot for history
    const taskResult = await query(
      `SELECT mt.*, u.full_name as assignee_name
       FROM equipment_maintenance_tasks mt
       LEFT JOIN users u ON mt.assigned_user_id = u.id
       WHERE mt.id = $1`,
      [taskId],
    );
    const task = taskResult.rows[0];
    if (!task) throw new Error("Task not found");

    await ensureMaintenanceTaskInitialHistory(task);
    const currentCycle = await getMaintenanceTaskCurrentCycle(taskId);

    // 2. Unassign and return to pool
    const skippedRes = await query(
      `UPDATE equipment_maintenance_tasks
       SET assigned_user_id = NULL,
           session_id = NULL,
           status = CASE WHEN verification_status = 'REJECTED' THEN 'REWORK' ELSE 'PENDING' END,
           notes = COALESCE(notes || E'\n', '') || $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        taskId,
        `[${new Date().toISOString()}] Отложено через терминал. Причина: ${notes || "Не указана"}. Был назначен: ${task.assignee_name || "Неизвестно"}`,
      ],
    );

    // 3. Log event
    await appendMaintenanceTaskEvent({
      taskId,
      cycleNo: currentCycle,
      eventType: "REVERTED",
      actorUserId: userId,
      note: notes || "Отложено через терминал",
    });

    return { success: true, task: skippedRes.rows[0] };
  }

  const taskHistorySnapshotRes = await query(
    `SELECT id, verification_status, completed_at, completed_by, verified_at, verified_by, rejection_reason, verification_note, notes, photos, photos_before, photos_after
         FROM equipment_maintenance_tasks
         WHERE id = $1`,
    [taskId],
  );
  const currentTaskSnapshot = taskHistorySnapshotRes.rows[0];

  if (!currentTaskSnapshot) {
    throw new Error("Task not found");
  }

  await ensureMaintenanceTaskInitialHistory(currentTaskSnapshot);
  const currentCycle = await getMaintenanceTaskCurrentCycle(taskId);
  const isResubmission = currentTaskSnapshot.verification_status === "REJECTED";
  const nextCycle = isResubmission
    ? currentCycle + 1
    : Math.max(currentCycle, 1);

  const taskRes = await query(
    `
        SELECT mt.due_date, mt.task_type, e.type as equipment_type, e.id as equipment_id
        FROM equipment_maintenance_tasks mt
        JOIN equipment e ON mt.equipment_id = e.id
        WHERE mt.id = $1
    `,
    [taskId],
  );

  const task = taskRes.rows[0];
  if (!task) throw new Error("Task details not found");

  const equipmentId = task.equipment_id;

  // KPI and Bonus Logic (simplified for brevity here, normally I'd copy full logic)
  // For now, let's keep it robust as in the original route.

  const rolesRes = await query(
    `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2 ORDER BY priority ASC`,
    [clubId, userId],
  );

  let rolesList = rolesRes.rows.map((r: any) => r.role_id);

  if (rolesList.length === 0) {
    const userRes = await query(
      `SELECT role_id FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows[0]?.role_id) {
      rolesList.push(userRes.rows[0].role_id);
    }
  }

  let schemeFormula: any = null;

  if (rolesList.length > 0) {
    for (const roleId of rolesList) {
      const roleSchemeRes = await query(
        `SELECT sv.formula
                 FROM employee_role_salary_assignments ersa
                 JOIN salary_schemes ss ON ersa.scheme_id = ss.id
                 JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
                 WHERE ersa.user_id = $1 AND ersa.club_id = $2 AND ersa.role_id = $3 AND ss.id IS NOT NULL
                 ORDER BY sv.version DESC
                 LIMIT 1`,
        [userId, clubId, roleId],
      );
      if (roleSchemeRes.rows.length > 0) {
        schemeFormula = roleSchemeRes.rows[0]?.formula;
        break;
      }
    }
  }

  if (!schemeFormula) {
    const userSchemeRes = await query(
      `SELECT sv.formula
             FROM employee_salary_assignments esa
             JOIN salary_schemes ss ON esa.scheme_id = ss.id
             JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
             WHERE esa.user_id = $1 AND esa.club_id = $2 AND ss.id IS NOT NULL
             ORDER BY sv.version DESC
             LIMIT 1`,
      [userId, clubId],
    );
    if (userSchemeRes.rows.length > 0) {
      schemeFormula = userSchemeRes.rows[0]?.formula;
    }
  }

  const finalSchemeFormula = schemeFormula || {};
  const bonuses = finalSchemeFormula.bonuses || [];
  const kpiBonus = bonuses.find(
    (b: any) => b.type === "maintenance_kpi" || b.type === "MAINTENANCE_KPI",
  );

  let bonusEarned = 0;
  if (kpiBonus) {
    const perTypeRewards = kpiBonus.per_equipment_type_rewards || [];
    const equipmentTypeCode = task.equipment_type;
    const typeReward = perTypeRewards.find(
      (r: any) =>
        r.equipment_type_code?.trim().toLowerCase() ===
        equipmentTypeCode?.trim().toLowerCase(),
    );
    const baseValue = typeReward
      ? Number(typeReward.amount)
      : Number(kpiBonus.amount) || 0;
    bonusEarned = baseValue;
  }

  const overdueDaysAtCompletion = Math.max(
    0,
    Math.floor(
      (new Date(new Date().toDateString()).getTime() -
        new Date(new Date(task.due_date).toDateString()).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const wasOverdue = overdueDaysAtCompletion > 0;

  const overduePenaltyPreview = calculateMaintenanceOverduePenalty(
    {
      overdue_tolerance_days: kpiBonus?.overdue_tolerance_days,
      overdue_penalty_mode: kpiBonus?.overdue_penalty_mode,
      overdue_penalty_amount: kpiBonus?.overdue_penalty_amount,
      late_penalty_multiplier: kpiBonus?.late_penalty_multiplier,
    },
    [
      {
        overdue_days_at_completion: overdueDaysAtCompletion,
        bonus_earned: bonusEarned,
        was_overdue: wasOverdue,
      },
    ],
  );

  const overduePenalty = overduePenaltyPreview.total;

  // Use photos_after for the main 'photos' column to maintain backward compatibility for now
  // while also populating the new specific columns.
  const allPhotos = [...photos_before, ...photos_after];

  await query(
    `UPDATE equipment_maintenance_tasks
         SET status = 'COMPLETED',
             verification_status = 'PENDING',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             completed_by = $2,
             assigned_user_id = $2,
             photos = $3,
             photos_before = $4,
             photos_after = $5,
             notes = $6,
             verified_at = NULL,
             verified_by = NULL,
             verification_note = NULL,
             rejection_reason = NULL,
             bonus_earned = $7,
             overdue_penalty = $8,
             overdue_days_at_completion = $9,
             was_overdue = $10,
             responsible_user_id_at_completion = $2
         WHERE id = $1`,
    [
      taskId,
      userId,
      allPhotos,
      photos_before,
      photos_after,
      notes,
      bonusEarned,
      overduePenalty,
      overdueDaysAtCompletion,
      wasOverdue,
    ],
  );

  await appendMaintenanceTaskEvent({
    taskId,
    cycleNo: nextCycle,
    eventType: isResubmission ? "RESUBMITTED" : "SUBMITTED",
    actorUserId: userId,
    taskNotes: notes,
    photos: allPhotos,
    photos_before,
    photos_after,
  });

  // Update equipment last_cleaned_at
  await query(
    `UPDATE equipment
         SET last_cleaned_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
    [equipmentId],
  );

  // Performance Log
  if (performance_data && Object.keys(performance_data).length > 0) {
    await query(
      `INSERT INTO equipment_performance_logs (equipment_id, club_id, recorded_by, metrics_data, notes, maintenance_task_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        equipmentId,
        clubId,
        userId,
        JSON.stringify(performance_data),
        notes || null,
        taskId,
      ],
    );
  }

  // Auto-create next task
  if (kpiBonus?.auto_create_next_task !== false) {
    const equipmentInfo = await query(
      `SELECT e.id,
              e.maintenance_enabled,
              e.cleaning_interval_days,
              e.cleaning_interval_override_days,
              CASE
                WHEN e.assignment_mode = 'DIRECT'
                     AND ce.is_active = TRUE
                     AND ce.dismissed_at IS NULL
                THEN e.assigned_user_id
                ELSE NULL
              END as effective_assigned_user_id,
              COALESCE(c.timezone, 'Europe/Moscow') as timezone
       FROM equipment e
       LEFT JOIN clubs c ON c.id = e.club_id
       LEFT JOIN club_employees ce ON ce.club_id = e.club_id AND ce.user_id = e.assigned_user_id
       WHERE e.id = $1`,
      [equipmentId],
    );

    if (
      equipmentInfo.rows.length > 0 &&
      equipmentInfo.rows[0].maintenance_enabled !== false
    ) {
      const eq = equipmentInfo.rows[0];
      const intervalDays = Math.max(
        1,
        Number(
          eq.cleaning_interval_override_days || eq.cleaning_interval_days,
        ) || 30,
      );

      const nextDueDate = new Date();
      nextDueDate.setHours(0, 0, 0, 0);
      nextDueDate.setDate(nextDueDate.getDate() + intervalDays);
      let finalDueDateStr = formatDateKeyInTimezone(
        nextDueDate,
        eq.timezone || "Europe/Moscow",
      );
      const finalAssignedUserId = eq.effective_assigned_user_id || null;

      if (finalAssignedUserId) {
        const shiftRes = await query(
          `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date
           FROM work_schedules
           WHERE club_id = $1 AND user_id = $2 AND date >= $3
           ORDER BY date ASC LIMIT 1`,
          [clubId, finalAssignedUserId, finalDueDateStr],
        );
        if (shiftRes.rows[0]?.date) {
          finalDueDateStr = String(shiftRes.rows[0].date);
        }
      }

      const existingTask = await query(
        `SELECT id FROM equipment_maintenance_tasks
                 WHERE equipment_id = $1 AND task_type = 'CLEANING'
                 AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
                 LIMIT 1`,
        [equipmentId],
      );

      if (existingTask.rows.length === 0) {
        await query(
          `INSERT INTO equipment_maintenance_tasks
                     (club_id, equipment_id, task_type, due_date, assigned_user_id, status, created_by, cycle_no)
                     VALUES ($1, $2, 'CLEANING', $3, $4, 'PENDING', $5, 1)
                     ON CONFLICT DO NOTHING`,
          [
            clubId,
            equipmentId,
            finalDueDateStr,
            finalAssignedUserId,
            userId,
          ],
        );
      }
    }
  }

  // Side effects: ISSUE and LAUNDRY

  if (status_mode === "ISSUE" && issue_title) {
    await query(
      `INSERT INTO equipment_issues (
            club_id, equipment_id, reported_by, title, description, severity, status, maintenance_task_id
        ) VALUES ($1, $2, $3, $4, $5, 'MEDIUM', 'OPEN', $6)`,
      [
        clubId,
        equipmentId,
        userId,
        issue_title,
        issue_description || null,
        taskId,
      ],
    );
  } else if (
    status_mode === "LAUNDRY" &&
    issue_title &&
    isLaundryEquipmentType(task.equipment_type)
  ) {
    // Check for existing active laundry request
    const existingLaundry = await query(
      `SELECT id FROM equipment_laundry_requests
         WHERE club_id = $1 AND equipment_id = $2
         AND status IN ('NEW', 'SENT_TO_LAUNDRY', 'READY_FOR_RETURN')
         LIMIT 1`,
      [clubId, equipmentId],
    );

    if (existingLaundry.rows.length === 0) {
      await query(
        `INSERT INTO equipment_laundry_requests (
                club_id, equipment_id, maintenance_task_id, requested_by, source, status, title, description, photos
            ) VALUES ($1, $2, $3, $4, 'EMPLOYEE_SERVICE', 'NEW', $5, $6, $7)`,
        [
          clubId,
          equipmentId,
          taskId,
          userId,
          issue_title,
          issue_description || null,
          photos_after,
        ],
      );
    }
  }

  return { success: true };
}
