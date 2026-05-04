import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { getClubApiAccess, requireClubOwner } from "@/lib/club-api-access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getClubApiAccess(String(clubId));
    if (!access.isFullAccess)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const canEdit = access.isOwner;

    // Get customizable roles
    const rolesRes = await query(
      `SELECT
                r.id,
                r.name,
                COALESCE(crs.employee_access_settings, r.employee_access_settings, '{}'::jsonb) as employee_access_settings
             FROM roles r
             LEFT JOIN club_role_settings crs ON crs.role_id = r.id AND crs.club_id = $1
             WHERE r.is_customizable = true
             ORDER BY r.id ASC`,
      [clubId],
    );

    return NextResponse.json({
      roles: rolesRes.rows,
      canEdit,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;
    const { roleId, employee_access_settings } = await request.json();

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireClubOwner(String(clubId));

    // Check if role is customizable
    const roleRes = await query(
      `SELECT is_customizable FROM roles WHERE id = $1`,
      [roleId],
    );
    if (roleRes.rowCount === 0 || !roleRes.rows[0].is_customizable) {
      return NextResponse.json(
        { error: "Роль нельзя изменять" },
        { status: 403 },
      );
    }

    // Upsert club role settings
    await query(
      `INSERT INTO club_role_settings (club_id, role_id, employee_access_settings, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW())
             ON CONFLICT (club_id, role_id)
             DO UPDATE SET employee_access_settings = EXCLUDED.employee_access_settings, updated_at = NOW()`,
      [clubId, roleId, JSON.stringify(employee_access_settings)],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
