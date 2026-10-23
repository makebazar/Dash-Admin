import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { appendMaintenanceTaskEvent } from "@/lib/maintenance-task-events";
import {
  effectiveEquipmentAssigneeSql,
  hasActiveClubAccess,
} from "@/lib/maintenance-task-logic";

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
    const { action, comment, photos } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "REJECT" && !comment) {
      return NextResponse.json(
        { error: "Comment is required for rejection" },
        { status: 400 },
      );
    }

    const taskRes = await query(
      `SELECT mt.id,
              mt.status,
              mt.equipment_id,
              mt.task_type,
              mt.notes,
              mt.photos,
              mt.cycle_no,
              mt.assigned_user_id,
              CASE
                WHEN mt.assigned_user_id IS NOT NULL
                     AND (
                       (ce_task.is_active = TRUE AND ce_task.dismissed_at IS NULL)
                       OR c.owner_id = mt.assigned_user_id
                     )
                THEN mt.assigned_user_id
                ELSE (${effectiveEquipmentAssigneeSql})
              END as rework_assignee_id
       FROM equipment_maintenance_tasks mt
       JOIN equipment e ON mt.equipment_id = e.id
       LEFT JOIN clubs c ON c.id = e.club_id
       LEFT JOIN club_employees ce_task ON ce_task.user_id = mt.assigned_user_id AND ce_task.club_id = e.club_id
       LEFT JOIN club_employees ce_equip ON ce_equip.user_id = e.assigned_user_id AND ce_equip.club_id = e.club_id
       WHERE mt.id = $1 AND e.club_id = $2`,
      [taskId, clubId],
    );
    const task = taskRes.rows[0];
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const currentCycle = task.cycle_no || 1;
    let updateQuery = "";
    let queryParams: any[] = [];

    if (action === "APPROVE") {
      if (task.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Можно одобрить только выполненную задачу" },
          { status: 409 },
        );
      }
      updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'APPROVED',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    verification_note = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id
            `;
      queryParams = [taskId, userId, comment || null];
    } else if (action === "REJECT") {
      // 1. Cleanup future pending tasks for this equipment
      await query(
        `DELETE FROM equipment_maintenance_tasks
                 WHERE equipment_id = $1
                   AND task_type = $2
                   AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
                   AND id != $3`,
        [task.equipment_id, task.task_type, taskId],
      );

      // 2. Revert equipment last_cleaned_at
      if (task.task_type === "CLEANING") {
        const previousCompletedTask = await query(
          `SELECT completed_at
                     FROM equipment_maintenance_tasks
                     WHERE equipment_id = $1
                       AND task_type = 'CLEANING'
                       AND status = 'COMPLETED'
                       AND id != $2
                     ORDER BY completed_at DESC
                     LIMIT 1`,
          [task.equipment_id, taskId],
        );

        await query(
          `UPDATE equipment
                     SET last_cleaned_at = $1
                     WHERE id = $2`,
          [
            previousCompletedTask.rows[0]?.completed_at || null,
            task.equipment_id,
          ],
        );
      }

      // 3. Reject task into REWORK (or reassign to active equipment owner / free pool if completer was dismissed)
      updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'REJECTED',
                    status = 'REWORK',
                    session_id = NULL,
                    assigned_user_id = $4,
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    rejection_reason = $3,
                    completed_at = NULL,
                    bonus_earned = 0,
                    overdue_penalty = 0,
                    kpi_points = 0,
                    overdue_days_at_completion = 0,
                    was_overdue = FALSE,
                    responsible_user_id_at_completion = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING id
            `;
      queryParams = [taskId, userId, comment, task.rework_assignee_id || null];
    }

    const result = await query(updateQuery, queryParams);

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await appendMaintenanceTaskEvent({
      taskId,
      cycleNo: Math.max(currentCycle, 1),
      eventType: action === "APPROVE" ? "APPROVED" : "REJECTED",
      actorUserId: userId,
      note: comment || null,
      taskNotes: task.notes || null,
      photos:
        action === "REJECT" && Array.isArray(photos)
          ? photos
          : task.photos || [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify Task Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
