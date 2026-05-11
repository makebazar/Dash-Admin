import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { hasColumn } from "@/lib/db-compat";
import { calculateMaintenanceOverduePenalty } from "@/lib/maintenance-penalties";
import {
  appendMaintenanceTaskEvent,
  ensureMaintenanceTaskInitialHistory,
  getMaintenanceTaskCurrentCycle,
} from "@/lib/maintenance-task-events";
import { formatDateKeyInTimezone, parseDateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const photosRaw = body.photos;
    const photos = Array.isArray(photosRaw) ? photosRaw : null;
    const photosBeforeRaw = body.photos_before;
    const photos_before = Array.isArray(photosBeforeRaw)
      ? photosBeforeRaw
      : null;
    const photosAfterRaw = body.photos_after;
    const photos_after = Array.isArray(photosAfterRaw) ? photosAfterRaw : null;
    const notes = body.notes || null;
    const performance_data = body.performance_data || null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify access (employee or owner)
    const accessCheck = await query(
      `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
             UNION
             SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
      [clubId, userId],
    );

    if ((accessCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const taskHistorySnapshotRes = await query(
      `SELECT id, verification_status, completed_at, completed_by, verified_at, verified_by, rejection_reason, verification_note, notes, photos, photos_before, photos_after
             FROM equipment_maintenance_tasks
             WHERE id = $1`,
      [taskId],
    );
    const currentTaskSnapshot = taskHistorySnapshotRes.rows[0];

    if (!currentTaskSnapshot) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    try {
      const settingsRes = await query(
        `SELECT require_photos_on_completion, min_photos, require_notes_on_completion
                 FROM club_maintenance_settings
                 WHERE club_id = $1`,
        [clubId],
      );
      const settingsRow = settingsRes.rows[0] || null;
      const requirePhotos = settingsRow?.require_photos_on_completion !== false;
      const minPhotos = requirePhotos
        ? Math.max(1, Number(settingsRow?.min_photos) || 1)
        : 0;
      const requireNotes = settingsRow?.require_notes_on_completion === true;

      if (minPhotos > 0) {
        const photoCount = Array.isArray(photosRaw) ? photosRaw.length : 0;
        if (photoCount < minPhotos) {
          return NextResponse.json(
            { error: `Нужно приложить минимум фото: ${minPhotos}` },
            { status: 400 },
          );
        }
      }

      if (requireNotes) {
        const noteStr = String(notes || "").trim();
        if (!noteStr) {
          return NextResponse.json(
            { error: "Нужно заполнить комментарий к выполнению" },
            { status: 400 },
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
            { status: 400 },
          );
        }
      }
    }

    await ensureMaintenanceTaskInitialHistory(currentTaskSnapshot);
    const currentCycle = await getMaintenanceTaskCurrentCycle(taskId);
    const isResubmission =
      currentTaskSnapshot.verification_status === "REJECTED";
    const nextCycle = isResubmission
      ? currentCycle + 1
      : Math.max(currentCycle, 1);

    // 0. Get KPI Config from Active Salary Scheme & Current Task Info
    // Find the correct salary scheme for the user (role-based or direct)
    const taskRes = await query(
      `
            SELECT mt.due_date, mt.task_type, e.type as equipment_type
            FROM equipment_maintenance_tasks mt
            JOIN equipment e ON mt.equipment_id = e.id
            WHERE mt.id = $1
        `,
      [taskId],
    );

    const task = taskRes.rows[0];

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const rolesRes = await query(
      `SELECT role_id FROM club_employee_roles WHERE club_id = $1 AND user_id = $2 ORDER BY priority ASC`,
      [clubId, userId],
    );

    let schemeFormula: any = null;

    if (rolesRes.rows.length > 0) {
      for (const role of rolesRes.rows) {
        const roleSchemeRes = await query(
          `SELECT sv.formula
                     FROM employee_role_salary_assignments ersa
                     JOIN salary_schemes ss ON ersa.scheme_id = ss.id
                     JOIN salary_scheme_versions sv ON sv.scheme_id = ss.id
                     WHERE ersa.user_id = $1 AND ersa.club_id = $2 AND ersa.role_id = $3 AND ss.id IS NOT NULL
                     ORDER BY sv.version DESC
                     LIMIT 1`,
          [userId, clubId, role.role_id],
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

    // 1. Calculate Bonus
    // Штраф за просрочку применяется сразу при завершении задачи
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
    const responsibleUserIdAtCompletion = userId;

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

    const completeTask = await query(
      `UPDATE equipment_maintenance_tasks
             SET status = 'COMPLETED',
                 verification_status = 'PENDING',
                 completed_at = CURRENT_TIMESTAMP,
                 completed_by = $2,
                 photos = $3,
                 photos_before = COALESCE($10, photos_before),
                 photos_after = COALESCE($11, photos_after),
                 notes = $4,
                 verified_at = NULL,
                 verified_by = NULL,
                 verification_note = NULL,
                 rejection_reason = NULL,
                 bonus_earned = $5,
                 overdue_penalty = $6,
                 overdue_days_at_completion = $7,
                 was_overdue = $8,
                 responsible_user_id_at_completion = $9
             WHERE id = $1
             RETURNING equipment_id`,
      [
        taskId,
        userId,
        photos,
        notes,
        bonusEarned,
        overduePenalty,
        overdueDaysAtCompletion,
        wasOverdue,
        responsibleUserIdAtCompletion,
        photos_before,
        photos_after,
      ],
    );

    if ((completeTask.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await appendMaintenanceTaskEvent({
      taskId,
      cycleNo: nextCycle,
      eventType: isResubmission ? "RESUBMITTED" : "SUBMITTED",
      actorUserId: userId,
      taskNotes: notes,
      photos,
      photos_before,
      photos_after,
    });

    const equipmentId = completeTask.rows[0].equipment_id;

    // 2. Update equipment last_cleaned_at
    await query(
      `UPDATE equipment
             SET last_cleaned_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
      [equipmentId],
    );

    // 3. Auto-create next cleaning task if interval-based scheduling is enabled
    if (kpiBonus?.auto_create_next_task !== false) {
      const hasCleaningIntervalOverrideColumn = await hasColumn(
        "equipment",
        "cleaning_interval_override_days",
      );
      const effectiveCleaningIntervalSql = hasCleaningIntervalOverrideColumn
        ? `COALESCE(e.cleaning_interval_override_days, e.cleaning_interval_days)`
        : `e.cleaning_interval_days`;

      const equipmentInfo = await query(
        `SELECT e.id, e.assigned_user_id, e.cleaning_interval_days, e.cleaning_interval_override_days, et.code as type_code
                 FROM equipment e
                 JOIN equipment_types et ON e.type = et.code
                 WHERE e.id = $1`,
        [equipmentId],
      );

      if (equipmentInfo.rows.length > 0) {
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

        const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

        const existingTask = await query(
          `SELECT id FROM equipment_maintenance_tasks
                     WHERE equipment_id = $1 AND task_type = 'CLEANING'
                     AND status IN ('PENDING', 'IN_PROGRESS')
                     LIMIT 1`,
          [equipmentId],
        );

        if (existingTask.rows.length === 0) {
          await query(
            `INSERT INTO equipment_maintenance_tasks
                         (club_id, equipment_id, task_type, due_date, assigned_user_id, status, created_by, cycle_no)
                         VALUES ($1, $2, 'CLEANING', $3, $4, 'PENDING', $5, 1)`,
            [clubId, equipmentId, nextDueDateStr, eq.assigned_user_id, userId],
          );
        }
      }
    }

    // 4. Update assignment mode
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
      [equipmentId],
    );
    await query(
      `UPDATE equipment
             SET assigned_user_id = NULL,
                 assignment_mode = 'FREE_POOL'
             WHERE id = $1
               AND assignment_mode = 'INHERIT'
               AND workstation_id IS NULL`,
      [equipmentId],
    );

    return NextResponse.json({
      success: true,
      overdue_record: {
        was_overdue: wasOverdue,
        overdue_days_at_completion: overdueDaysAtCompletion,
        estimated_penalty: overduePenaltyPreview.total,
      },
    });
  } catch (error) {
    console.error("Complete Task Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
