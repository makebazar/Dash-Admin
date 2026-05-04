import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/super-admin";
import { hasColumn } from "@/lib/db-compat";

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

    const hasSubscriptionStatus = await hasColumn(
      "users",
      "subscription_status",
    );
    const hasSubscriptionStartedAt = await hasColumn(
      "users",
      "subscription_started_at",
    );
    const hasSubscriptionEndsAt = await hasColumn(
      "users",
      "subscription_ends_at",
    );

    const subscriptionColumns = `
            ${hasSubscriptionStatus ? "u.subscription_status" : "'active' as subscription_status"},
            ${hasSubscriptionStartedAt ? "u.subscription_started_at" : "NULL::timestamp as subscription_started_at"},
            ${hasSubscriptionEndsAt ? "u.subscription_ends_at" : "NULL::timestamp as subscription_ends_at"}
        `;

    const result = await query(`
            SELECT
                u.id,
                u.full_name,
                u.phone_number,
                u.is_super_admin,
                u.created_at,
                COALESCE(u.subscription_plan, 'starter') as subscription_plan,
                ${subscriptionColumns},
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'name', c.name,
                            'role', 'owner'
                        )
                    )
                    FROM clubs c
                    WHERE c.owner_id = u.id
                ), '[]'::json) as owned_clubs,
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'name', c.name,
                            'role', COALESCE(ce.role, 'Сотрудник'),
                            'is_manager', CASE WHEN ce.role IN ('Управляющий', 'Manager') THEN TRUE ELSE FALSE END                        )
                    )
                    FROM club_employees ce
                    JOIN clubs c ON c.id = ce.club_id
                    WHERE ce.user_id = u.id
                      AND ce.is_active = TRUE
                      AND ce.dismissed_at IS NULL
                ), '[]'::json) as employee_clubs
            FROM users u
            ORDER BY
                u.is_super_admin DESC,
                CASE
                    WHEN EXISTS (SELECT 1 FROM clubs c WHERE c.owner_id = u.id) THEN 0
                    WHEN EXISTS (SELECT 1 FROM club_employees ce WHERE ce.user_id = u.id AND ce.role IN ('Управляющий', 'Manager')) THEN 1
                    ELSE 2
                END,
                u.full_name ASC
        `);

    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error("Get Users Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM users WHERE id = $1`, [targetUserId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete User Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
