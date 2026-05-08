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
    const { equipment_id, reason } = body;

    if (!equipment_id) {
      return NextResponse.json(
        { error: "equipment_id обязателен" },
        { status: 400 },
      );
    }

    // Verify equipment belongs to club
    const equipCheck = await query(
      `SELECT id, status FROM equipment WHERE id = $1 AND club_id = $2`,
      [equipment_id, clubId],
    );

    if (equipCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "Оборудование не найдено" },
        { status: 404 },
      );
    }

    const status = equipCheck.rows[0].status;
    const reasonsMap: Record<string, string> = {
      WRITTEN_OFF: "Списано",
      STORAGE: "На хранении",
      TRANSFERRED: "Передано",
      DELETED: "Удалено",
    };

    const normalizedReason = reason || reasonsMap[status] || "Статус изменён";

    // Get count of tasks before cleanup
    const taskCountResult = await query(
      `SELECT status, COUNT(*) as count
             FROM equipment_maintenance_tasks
             WHERE equipment_id = $1
             GROUP BY status`,
      [equipment_id],
    );
    const tasksBefore = taskCountResult.rows.reduce(
      (acc: Record<string, number>, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      },
      {},
    );

    // Cancel all pending/in_progress tasks
    const updateResult = await query(
      `UPDATE equipment_maintenance_tasks
             SET status = 'CANCELLED',
                 notes = COALESCE(notes || E'\n', '') || $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE equipment_id = $2
               AND status IN ('PENDING', 'IN_PROGRESS')`,
      [`[Система] Задача отменена: ${normalizedReason}`, equipment_id],
    );

    // Get count after cleanup
    const taskCountAfterResult = await query(
      `SELECT status, COUNT(*) as count
             FROM equipment_maintenance_tasks
             WHERE equipment_id = $1
             GROUP BY status`,
      [equipment_id],
    );
    const tasksAfter = taskCountAfterResult.rows.reduce(
      (acc: Record<string, number>, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      },
      {},
    );

    const cancelled =
      (tasksBefore["PENDING"] || 0) +
      (tasksBefore["IN_PROGRESS"] || 0) -
      (tasksAfter["PENDING"] || 0) -
      (tasksAfter["IN_PROGRESS"] || 0);

    return NextResponse.json({
      success: true,
      equipment_id,
      cancelled,
      remaining_tasks: tasksAfter,
    });
  } catch (error: any) {
    console.error("Cleanup equipment tasks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
