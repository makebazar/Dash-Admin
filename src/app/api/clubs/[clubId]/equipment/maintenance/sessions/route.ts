import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

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
    // Only bind tasks that are currently PENDING or REWORK and not already bound to another session
    const updateResult = await query(
      `UPDATE equipment_maintenance_tasks
             SET session_id = $1, status = 'IN_PROGRESS', assigned_user_id = $4
             WHERE id = ANY($2) 
               AND club_id = $3
               AND (status = 'PENDING' OR status = 'REWORK')
               AND session_id IS NULL
             RETURNING id`,
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
