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

    // 1. Fetch Ticket Issuance Logs
    const issuanceLogs = await query(
      `SELECT
        t.id,
        p.full_name as player_name,
        p.phone_number as player_phone,
        t.source,
        t.created_at,
        COUNT(*) OVER(PARTITION BY t.player_id, t.created_at, t.source) as batch_count
       FROM promo_tickets t
       JOIN promo_players p ON t.player_id = p.id
       WHERE t.club_id = $1
       ORDER BY t.created_at DESC
       LIMIT 100`,
      [clubId],
    );

    // 2. Fetch Game History Logs
    const gameLogs = await query(
      `SELECT
        h.id,
        p.full_name as player_name,
        p.phone_number as player_phone,
        h.game_type,
        COALESCE(
          pr.name,
          CASE
            WHEN h.game_type LIKE 'TOPUP%' THEN 'Пополнение: ' || (h.result_data->>'amount') || ' ₽'
            WHEN h.game_type LIKE 'SERVICE_AWARD%' THEN COALESCE(h.result_data->>'rule_name', 'Начисление услуг')
            WHEN h.game_type = 'BAR_BONUS_PURCHASE' THEN 'Покупка в баре: ' || (h.result_data->>'bonus_cost') || ' 🪙'
            WHEN h.game_type = 'WITHDRAW' THEN 'Вывод: ' || (h.result_data->>'amount') || ' ₽'
            WHEN h.game_type = 'QUEST_REWARD' THEN 'Награда за квест'
            ELSE NULL
          END
        ) as prize_name,
        COALESCE(
          pr.type,
          CASE
            WHEN h.game_type LIKE 'TOPUP%' THEN 'topup'
            WHEN h.game_type LIKE 'SERVICE_AWARD%' THEN 'service'
            WHEN h.game_type = 'BAR_BONUS_PURCHASE' THEN 'bar'
            WHEN h.game_type = 'WITHDRAW' THEN 'withdraw'
            WHEN h.game_type = 'QUEST_REWARD' THEN 'quest'
            ELSE 'other'
          END
        ) as prize_type,
        h.result_data,
        h.created_at
       FROM promo_history h
       JOIN promo_players p ON h.player_id = p.id
       LEFT JOIN promo_prizes pr ON h.prize_id = pr.id
       WHERE h.club_id = $1
       ORDER BY h.created_at DESC
       LIMIT 100`,
      [clubId],
    );

    // 3. Stats for today
    const stats = await query(
      `SELECT
        (SELECT COUNT(*) FROM promo_tickets WHERE club_id = $1 AND created_at >= CURRENT_DATE) as tickets_issued_today,
        (SELECT COUNT(*) FROM promo_history WHERE club_id = $1 AND created_at >= CURRENT_DATE) as games_played_today,
        (SELECT COALESCE(SUM(pr.value), 0) FROM promo_history h JOIN promo_prizes pr ON h.prize_id = pr.id WHERE h.club_id = $1 AND h.created_at >= CURRENT_DATE AND pr.type = 'virtual') as prize_money_today
      `,
      [clubId],
    );

    return NextResponse.json({
      success: true,
      issuanceLogs: issuanceLogs.rows,
      gameLogs: gameLogs.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error("Fetch Logs Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
