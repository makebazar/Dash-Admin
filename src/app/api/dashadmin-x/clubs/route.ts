import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

async function checkUserAccess() {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId)
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };

  const adminCheck = await query(
    `SELECT is_super_admin, is_staff, phone_number FROM users WHERE id = $1`,
    [userId],
  );

  const user = adminCheck.rows[0];
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const isSuper = isSuperAdmin(
    user.is_super_admin,
    userId,
    user.phone_number,
  );

  const isStaff = Boolean(user.is_staff);

  if (!isSuper && !isStaff) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId, isSuper, isStaff };
}

export async function GET(request: Request) {
  try {
    const auth = await checkUserAccess();
    if (!auth.ok) return auth.response;

    const { userId, isSuper } = auth;
    const { searchParams } = new URL(request.url);
    const showArchived = searchParams.get("archived") === "true";

    let clubsResult;
    let statsResult;

    if (isSuper) {
      // Fetch clubs for super admin
      clubsResult = await query(
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
                  u.subscription_plan as subscription_plan,
                  sp.name as subscription_plan_name,
                  ref_u.full_name as referred_by_name,
                  (SELECT COUNT(*) FROM club_employees ce WHERE ce.club_id = c.id AND ce.is_active = TRUE AND ce.dismissed_at IS NULL) as employee_count,
                  (SELECT COUNT(*) FROM club_workstations cw WHERE cw.club_id = c.id AND cw.is_active = TRUE) as workstation_count
              FROM clubs c
              LEFT JOIN users u ON u.id = c.owner_id
              LEFT JOIN subscription_plans sp ON sp.code = u.subscription_plan
              LEFT JOIN users ref_u ON ref_u.id = c.referred_by_id
              WHERE c.is_active = $1 OR $2 = TRUE
              ORDER BY c.created_at DESC
          `,
        [!showArchived, showArchived],
      );

      // Fetch overall stats for super admin
      statsResult = await query(`
              SELECT
                  COUNT(*) FILTER (WHERE is_active = TRUE) as total_clubs,
                  (SELECT COUNT(DISTINCT owner_id) FROM clubs WHERE is_active = TRUE) as total_owners,
                  (SELECT COUNT(*) FROM club_employees ce JOIN clubs c ON c.id = ce.club_id WHERE ce.is_active = TRUE AND ce.dismissed_at IS NULL AND c.is_active = TRUE) as total_employees,
                  (SELECT COUNT(*) FROM club_workstations cw JOIN clubs c ON c.id = cw.club_id WHERE cw.is_active = TRUE AND c.is_active = TRUE) as total_workstations
              FROM clubs
          `);
    } else {
      // Fetch clubs for staff (only their referred clubs)
      clubsResult = await query(
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
                  u.subscription_plan as subscription_plan,
                  sp.name as subscription_plan_name,
                  ref_u.full_name as referred_by_name,
                  (SELECT COUNT(*) FROM club_employees ce WHERE ce.club_id = c.id AND ce.is_active = TRUE AND ce.dismissed_at IS NULL) as employee_count,
                  (SELECT COUNT(*) FROM club_workstations cw WHERE cw.club_id = c.id AND cw.is_active = TRUE) as workstation_count
              FROM clubs c
              LEFT JOIN users u ON u.id = c.owner_id
              LEFT JOIN subscription_plans sp ON sp.code = u.subscription_plan
              LEFT JOIN users ref_u ON ref_u.id = c.referred_by_id
              WHERE c.referred_by_id = $3 AND (c.is_active = $1 OR $2 = TRUE)
              ORDER BY c.created_at DESC
          `,
        [!showArchived, showArchived, userId],
      );

      // Fetch overall stats for staff (only their referred clubs)
      statsResult = await query(
        `
              SELECT
                  COUNT(*) FILTER (WHERE is_active = TRUE) as total_clubs,
                  (SELECT COUNT(DISTINCT owner_id) FROM clubs WHERE is_active = TRUE AND referred_by_id = $1) as total_owners,
                  (SELECT COUNT(*) FROM club_employees ce JOIN clubs c ON c.id = ce.club_id WHERE ce.is_active = TRUE AND ce.dismissed_at IS NULL AND c.is_active = TRUE AND c.referred_by_id = $1) as total_employees,
                  (SELECT COUNT(*) FROM club_workstations cw JOIN clubs c ON c.id = cw.club_id WHERE cw.is_active = TRUE AND c.is_active = TRUE AND c.referred_by_id = $1) as total_workstations
              FROM clubs
              WHERE referred_by_id = $1
          `,
        [userId]
      );
    }

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
