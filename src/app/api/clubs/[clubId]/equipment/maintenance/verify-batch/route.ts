import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { appendMaintenanceTaskEvent } from "@/lib/maintenance-task-events";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const { action, taskIds, comment } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
    }

    if (action !== "APPROVE") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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

    // Fetch and check tasks belong to this club
    const tasksRes = await query(
      `SELECT t.id, t.equipment_id, t.task_type, t.notes, t.photos, t.cycle_no 
       FROM equipment_maintenance_tasks t
       JOIN equipment e ON t.equipment_id = e.id
       WHERE t.id = ANY($1::uuid[]) AND e.club_id = $2`,
      [taskIds, clubId],
    );

    if (tasksRes.rows.length === 0) {
      return NextResponse.json({ error: "No matching tasks found" }, { status: 404 });
    }

    for (const task of tasksRes.rows) {
      const taskId = task.id;
      const currentCycle = task.cycle_no || 1;

      // Update task status
      await query(
        `UPDATE equipment_maintenance_tasks
         SET verification_status = 'APPROVED',
             verified_at = CURRENT_TIMESTAMP,
             verified_by = $2,
             verification_note = $3
         WHERE id = $1`,
        [taskId, userId, comment || null],
      );

      // Record history event
      await appendMaintenanceTaskEvent({
        taskId,
        cycleNo: Math.max(currentCycle, 1),
        eventType: "APPROVED",
        actorUserId: userId,
        note: comment || null,
        taskNotes: task.notes || null,
        photos: task.photos || [],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify Batch Tasks Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
