import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { requireModuleAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    const { clubId } = await params;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireModuleAccess(String(clubId), "salaries", "view");

    const result = await query(
      `SELECT s.id, s.check_in, s.check_out, s.total_hours, s.calculated_salary, s.salary_breakdown, s.status, u.full_name, r.name as role_name
             FROM shifts s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE s.club_id = $1 AND s.calculated_salary IS NOT NULL AND s.check_out IS NOT NULL
             ORDER BY s.check_in DESC LIMIT 100`,
      [clubId],
    );

    return NextResponse.json({ accruals: result.rows });
  } catch (error: any) {
    console.error("Accruals Error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
