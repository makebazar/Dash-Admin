import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { hasActiveClubAccess } from "@/lib/maintenance-task-logic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;
    const body = await request.json().catch(() => ({}));

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { taskIds } = body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "At least one task is required" },
        { status: 400 },
      );
    }

    // 1. Create session
    const sessionResult = await query(
      `INSERT INTO equipment_maintenance_sessions (club_id, created_by)
             VALUES ($1, $2)
             RETURNING id`,
      [clubId, userId],
    );
    const sessionId = sessionResult.rows[0].id;

    // 2. Assign tasks to session and update their status to IN_PROGRESS
    // Only bind tasks that are currently PENDING, REWORK, or IN_PROGRESS (if assigned to this user, unassigned, or expired/abandoned)
    const updateResult = await query(
      `UPDATE equipment_maintenance_tasks mt
             SET session_id = $1,
                 status = 'IN_PROGRESS',
                 assigned_user_id = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE mt.id = ANY($2) 
               AND mt.club_id = $3
               AND (
                 mt.status = 'PENDING' 
                 OR mt.status = 'REWORK' 
                 OR (
                   mt.status = 'IN_PROGRESS' 
                   AND (
                     mt.assigned_user_id = $4 
                     OR mt.assigned_user_id IS NULL
                     OR mt.updated_at <= NOW() - INTERVAL '2 hours'
                     OR NOT EXISTS (
                       SELECT 1 FROM club_employees ce
                       WHERE ce.club_id = $3
                         AND ce.user_id = mt.assigned_user_id
                         AND ce.is_active = TRUE
                         AND ce.dismissed_at IS NULL
                     )
                     OR NOT EXISTS (
                       SELECT 1 FROM shifts s_active
                       WHERE s_active.user_id = mt.assigned_user_id
                         AND s_active.club_id = $3
                         AND s_active.check_out IS NULL
                         AND s_active.check_in > NOW() - INTERVAL '16 hours'
                     )
                   )
                 )
               )
             RETURNING mt.id`,
      [sessionId, taskIds, clubId, userId],
    );

    if ((updateResult.rowCount || 0) === 0) {
      // If we failed to bind any tasks, delete the empty session we just created
      await query(`DELETE FROM equipment_maintenance_sessions WHERE id = $1`, [sessionId]);
      return NextResponse.json(
        { error: "Не удалось привязать задачи. Возможно, они уже выполняются другим сотрудником." },
        { status: 409 },
      );
    }

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("Create Maintenance Session Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasActiveClubAccess(clubId, userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await query(
      `SELECT s.*, u.full_name as creator_name,
             (SELECT COUNT(*) FROM equipment_maintenance_tasks WHERE session_id = s.id) as task_count
             FROM equipment_maintenance_sessions s
             LEFT JOIN users u ON s.created_by = u.id
             WHERE s.club_id = $1 AND s.created_by = $2
             ORDER BY s.created_at DESC`,
      [clubId, userId],
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("List Maintenance Sessions Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
