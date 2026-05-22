import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import {
  appendMaintenanceTaskEvent,
  ensureMaintenanceTaskInitialHistory,
  getMaintenanceTaskCurrentCycle,
} from "@/lib/maintenance-task-events";

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
      `SELECT id, equipment_id, task_type, notes, photos, cycle_no FROM equipment_maintenance_tasks WHERE id = $1`,
      [taskId],
    );
    const task = taskRes.rows[0];
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const currentCycle = task.cycle_no || 1;
    let updateQuery = "";
    let queryParams: any[] = [];

    if (action === "APPROVE") {
      updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'APPROVED',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    verification_note = $3
                WHERE id = $1
                RETURNING id
            `;
      queryParams = [taskId, userId, comment || null];
    } else if (action === "REJECT") {
      // 1. Cleanup
      await query(
        `DELETE FROM equipment_maintenance_tasks
                 WHERE equipment_id = $1
                   AND task_type = $2
                   AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
                   AND id != $3`,
        [task.equipment_id, task.task_type, taskId],
      );

      // 2. Revert equipment
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

      // 3. Prepare the update query for rejection
      // We also clear photos_before/after so employee can re-upload them if needed
      // OR we keep them but set status to REJECTED.
      updateQuery = `
                UPDATE equipment_maintenance_tasks
                SET verification_status = 'REJECTED',
                    status = 'REWORK',
                    verified_at = CURRENT_TIMESTAMP,
                    verified_by = $2,
                    rejection_reason = $3,
                    completed_at = NULL,
                    bonus_earned = 0,
                    kpi_points = 0,
                    overdue_days_at_completion = 0,
                    was_overdue = FALSE,
                    responsible_user_id_at_completion = NULL
                WHERE id = $1
                RETURNING id
            `;
      queryParams = [taskId, userId, comment];
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
