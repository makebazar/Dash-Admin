import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");

    if (!clubId) {
      return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
    }

    try {
      const { requireClubApiAccess } = await import("@/lib/club-api-access");
      await requireClubApiAccess(clubId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Forbidden" }, { status: e.status || 403 });
    }

    const result = await query(
      `SELECT q.id, p.full_name as player_name, p.phone_number as player_phone,
                    COALESCE(pr.name, q.custom_reward_name, 'Вывод бонусов: ' || q.withdraw_amount || ' ₽') as prize_name,
                    CASE 
                        WHEN COALESCE(pr.type, q.prize_type, 'withdraw') IN ('withdraw', 'bonus_limitless', 'bonus_standard') THEN 'withdraw'
                        ELSE 'physical'
                    END as prize_type,
                    q.status, q.created_at, q.withdraw_amount
             FROM promo_prize_queue q
             JOIN promo_players p ON q.player_id = p.id
             LEFT JOIN promo_prizes pr ON q.prize_id = pr.id
             WHERE q.club_id = $1 AND q.status = 'pending'
             ORDER BY q.created_at DESC`,
      [clubId],
    );

    return NextResponse.json({ queue: result.rows });
  } catch (error) {
    console.error("Queue Fetch Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
