import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import {
  completeMaintenanceTask,
  effectiveEquipmentAssigneeSql,
  effectiveStatusSql,
  effectiveTaskAssigneeSql,
  hasActiveClubAccess,
} from "@/lib/maintenance-task-logic";

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

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
        COALESCE(inst.cleaning_time_minutes, et.cleaning_time_minutes) as cleaning_time_minutes,
        et.name_ru as equipment_type_name,
        -- Fetch the latest event of type REJECTED to show rejection/rework reason if status is REWORK
        (
          SELECT note 
          FROM equipment_maintenance_task_events 
          WHERE task_id = mt.id AND event_type = 'REJECTED' 
          ORDER BY created_at DESC LIMIT 1
        ) as rejection_reason
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN equipment_types et ON e.type = et.code
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
        type_name: task.equipment_type_name,
        identifier: task.equipment_identifier,
        brand: task.equipment_brand,
        model: task.equipment_model,
        workstation_name: task.workstation_name,
        workstation_id: task.workstation_id,
        cleaning_time_minutes: task.cleaning_time_minutes,
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

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status, assigned_user_id, notes, claim } = body;

    // Delegate task completion to shared completeMaintenanceTask logic
    if (!claim && status === "COMPLETED") {
      const completed = await completeMaintenanceTask({
        clubId,
        taskId,
        userId,
        notes,
      });
      return NextResponse.json(completed.task);
    }

    // Verify task belongs to club and get effective assignment info
    const taskCheck = await query(
      `SELECT mt.*, e.id as equipment_id,
              CASE 
                WHEN e.assignment_mode = 'DIRECT' AND ce_equip.is_active = TRUE AND ce_equip.dismissed_at IS NULL THEN 'DIRECT'
                ELSE 'FREE_POOL'
              END as effective_assignment_mode,
              (${effectiveEquipmentAssigneeSql}) as effective_assigned_user_id
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN club_employees ce_equip ON ce_equip.user_id = e.assigned_user_id AND ce_equip.club_id = e.club_id
       WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );

    if ((taskCheck.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

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
      updates.push(`session_id = NULL`);
    } else {
      if (status !== undefined) {
        const resolvedStatus =
          status === "PENDING" && task.verification_status === "REJECTED"
            ? "REWORK"
            : status;
        updates.push(`status = $${paramIndex}`);
        values.push(resolvedStatus);
        paramIndex++;

        if (status === "PENDING" || status === "REWORK") {
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
      }

      if (assigned_user_id !== undefined) {
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
             SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramIndex}
             RETURNING *`,
      values,
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error("Update Maintenance Task Error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
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
