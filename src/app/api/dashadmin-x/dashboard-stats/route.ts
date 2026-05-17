import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";

export async function GET() {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statsResult = await query(`
            SELECT
                (SELECT COUNT(*) FROM clubs) as total_clubs,
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM clubs WHERE subscription_status = 'active') as active_subscriptions,
                (SELECT COALESCE(SUM(
                    CASE
                        WHEN subscription_plan = 'starter' THEN 2900
                        WHEN subscription_plan = 'pro' THEN 7900
                        WHEN subscription_plan = 'enterprise' THEN 19900
                        ELSE 0
                    END
                ), 0) FROM clubs WHERE subscription_status = 'active') as monthly_revenue
            FROM (SELECT 1) dummy
        `);

    const stats = statsResult.rows[0];

    return NextResponse.json({
      stats: {
        totalClubs: parseInt(stats.total_clubs),
        totalUsers: parseInt(stats.total_users),
        activeSubscriptions: parseInt(stats.active_subscriptions),
        monthlyRevenue: parseInt(stats.monthly_revenue),
      },
      recentActivities: [], // Placeholder for now or you can fetch actual activities
    });
  } catch (error) {
    console.error("Get Admin Stats Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
