import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireModuleAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "shifts", "view");

    // Get active shifts
    const result = await query(
      `SELECT
        s.id,
        s.check_in,
        s.total_hours,
        u.full_name as user_name,
        r.name as role_name
       FROM shifts s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       JOIN shift_reports sr ON s.shift_report_id = sr.id
       WHERE sr.club_id = $1 AND s.status = 'ACTIVE'
       ORDER BY s.check_in DESC`,
      [clubId],
    );

    const shifts = result.rows.map((row) => ({
      id: row.id,
      user_name: row.user_name,
      role: row.role_name || "Сотрудник",
      check_in: row.check_in,
      total_hours: parseFloat(row.total_hours || 0),
    }));

    return NextResponse.json({ shifts });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden" },
        { status },
      );
    }
    console.error("Get Active Shifts Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
