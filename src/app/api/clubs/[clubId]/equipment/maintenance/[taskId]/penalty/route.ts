import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { requireClubFullAccess } from "@/lib/club-api-access";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string; taskId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId, taskId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireClubFullAccess(clubId);

    const body = await request.json();
    const { status, amount, reason } = body;

    // Validate status: 'DEFAULT' | 'WAIVED' | 'CUSTOM'
    if (!["DEFAULT", "WAIVED", "CUSTOM"].includes(status)) {
      return NextResponse.json(
        { error: "Недопустимый статус. Доступны: DEFAULT, WAIVED, CUSTOM" },
        { status: 400 },
      );
    }

    const customAmount =
      status === "CUSTOM"
        ? Math.max(0, parseFloat(amount) || 0)
        : null;

    const res = await query(
      `UPDATE equipment_maintenance_tasks
       SET penalty_override_status = $1,
           penalty_override_amount = $2,
           penalty_override_reason = $3,
           penalty_override_by = $4,
           penalty_override_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, overdue_penalty, penalty_override_status, penalty_override_amount, penalty_override_reason`,
      [status, customAmount, reason || null, userId, taskId],
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      task: res.rows[0],
    });
  } catch (error: any) {
    console.error("Maintenance penalty override error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
