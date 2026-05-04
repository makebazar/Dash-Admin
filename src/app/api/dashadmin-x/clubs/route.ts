import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/super-admin";

async function ensureSuperAdmin() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId)
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };

  const adminCheck = await query(
    `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const canAccess = isSuperAdmin(
    adminCheck.rows[0]?.is_super_admin,
    userId,
    adminCheck.rows[0]?.phone_number,
  );

  if (!canAccess) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const showArchived = searchParams.get("archived") === "true";

    // Fetch clubs with aggregate data
    const clubsResult = await query(
      `
            SELECT
                c.id,
                c.name,
                c.address,
                c.created_at,
                c.timezone,
                c.is_active,
                u.full_name as owner_name,
                u.phone_number as owner_phone,
                (SELECT COUNT(*) FROM club_employees ce WHERE ce.club_id = c.id AND ce.is_active = TRUE AND ce.dismissed_at IS NULL) as employee_count,
                (SELECT COUNT(*) FROM club_workstations cw WHERE cw.club_id = c.id AND cw.is_active = TRUE) as workstation_count
            FROM clubs c
            LEFT JOIN users u ON u.id = c.owner_id
            WHERE c.is_active = $1 OR $2 = TRUE
            ORDER BY c.created_at DESC
        `,
      [!showArchived, showArchived],
    );

    // Fetch overall stats
    const statsResult = await query(`
            SELECT
                COUNT(*) FILTER (WHERE is_active = TRUE) as total_clubs,
                (SELECT COUNT(DISTINCT owner_id) FROM clubs WHERE is_active = TRUE) as total_owners,
                (SELECT COUNT(*) FROM club_employees ce JOIN clubs c ON c.id = ce.club_id WHERE ce.is_active = TRUE AND ce.dismissed_at IS NULL AND c.is_active = TRUE) as total_employees,
                (SELECT COUNT(*) FROM club_workstations cw JOIN clubs c ON c.id = cw.club_id WHERE cw.is_active = TRUE AND c.is_active = TRUE) as total_workstations
            FROM clubs
        `);
    return NextResponse.json({
      clubs: clubsResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error("DashAdmin-X Clubs API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
