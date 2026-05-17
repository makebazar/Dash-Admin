import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

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

export async function GET() {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const result = await query(`
            SELECT
                u.id,
                u.full_name,
                u.phone_number,
                u.is_super_admin,
                u.created_at,
                u.subscription_plan,
                u.subscription_status,
                u.subscription_ends_at,
                (SELECT COUNT(*) FROM clubs WHERE owner_id = u.id) as clubs_owned_count,
                (SELECT COUNT(*) FROM club_employees WHERE user_id = u.id AND is_active = TRUE AND dismissed_at IS NULL) as clubs_work_count,
                COALESCE((
                    SELECT json_agg(json_build_object('id', c.id, 'name', c.name))
                    FROM clubs c WHERE c.owner_id = u.id
                ), '[]'::json) as owned_clubs,
                COALESCE((
                    SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'role', ce.role))
                    FROM club_employees ce
                    JOIN clubs c ON c.id = ce.club_id
                    WHERE ce.user_id = u.id AND ce.is_active = TRUE AND ce.dismissed_at IS NULL
                ), '[]'::json) as work_clubs
            FROM users u
            ORDER BY u.created_at DESC
        `);

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error("DashAdmin-X Users API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
