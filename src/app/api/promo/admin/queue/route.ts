import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
      `SELECT q.id, p.full_name as player_name, p.phone_number as player_phone,
                    COALESCE(pr.name, q.custom_reward_name, 'Вывод бонусов: ' || q.withdraw_amount || ' ₽') as prize_name,
                    CASE 
                        WHEN COALESCE(pr.type, q.prize_type, 'withdraw') IN ('withdraw', 'bonus_limitless', 'bonus_standard') THEN 'withdraw'
                        ELSE 'physical'
                    END as prize_type,
                    q.status, q.created_at
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
