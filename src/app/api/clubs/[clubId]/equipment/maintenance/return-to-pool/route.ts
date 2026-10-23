import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const cookieStore = await cookies();
    const userId = cookieStore.get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { task_ids, user_id, reason } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id обязателен" },
        { status: 400 },
      );
    }

    // Lookup user name (including dismissed or removed employees)
    const userCheck = await query(
      `SELECT u.id as user_id, u.full_name
             FROM users u
             WHERE u.id = $1`,
      [user_id],
    );

    if (userCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "Сотрудник не найден" },
        { status: 404 },
      );
    }

    const userName = userCheck.rows[0].full_name;

    let tasksToUpdate: string[] = [];
    if (task_ids && task_ids.length > 0) {
      tasksToUpdate = task_ids;
    } else {
      // Find all open tasks assigned to this user
      const pendingResult = await query(
        `SELECT id FROM equipment_maintenance_tasks
                 WHERE club_id = $1 AND assigned_user_id = $2 AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')`,
        [clubId, user_id],
      );
      tasksToUpdate = pendingResult.rows.map((r: any) => r.id);
    }

    if (tasksToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: "Нет задач для обновления",
      });
    }

    const result = await query(
      `UPDATE equipment_maintenance_tasks
             SET assigned_user_id = NULL,
                 session_id = NULL,
                 status = CASE
                   WHEN verification_status = 'REJECTED' THEN 'REWORK'
                   ELSE 'PENDING'
                 END,
                 notes = COALESCE(notes || E'\n', '') || $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ANY($2) AND club_id = $3 AND status IN ('PENDING', 'IN_PROGRESS', 'REWORK')
             RETURNING id`,
      [
        `[${new Date().toISOString()}] Возврат в пул: сотрудник ${userName}. Причина: ${reason || "Не указана"}`,
        tasksToUpdate,
        clubId,
      ],
    );

    return NextResponse.json({
      success: true,
      updated: result.rowCount,
      tasks: result.rows,
    });
  } catch (error: any) {
    console.error("Bulk return to pool error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
