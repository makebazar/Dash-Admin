import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const playerId = searchParams.get("playerId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let issuanceWhere = `t.club_id = $1`;
    const issuanceParams: any[] = [clubId];
    if (playerId) {
      issuanceWhere += ` AND t.player_id = $2`;
      issuanceParams.push(playerId);
    }

    const issuanceQuery = `SELECT
        MIN(t.id::text) as id,
        p.full_name as player_name,
        p.phone_number as player_phone,
        t.source,
        t.created_at,
        COUNT(*)::int as batch_count,
        h.game_type as history_game_type,
        h.result_data::text as history_result_data
       FROM promo_tickets t
       JOIN promo_players p ON t.player_id = p.id
       LEFT JOIN promo_history h ON t.history_id = h.id
       WHERE ${issuanceWhere}
       GROUP BY p.full_name, p.phone_number, t.source, t.created_at, t.player_id, t.history_id, h.game_type, h.result_data::text
       ORDER BY t.created_at DESC LIMIT 100`;

    const issuanceLogs = await query(issuanceQuery, issuanceParams);

    // 2. Fetch Game History Logs
    let gameQuery = `SELECT
        h.id,
        p.full_name as player_name,
        p.phone_number as player_phone,
        h.game_type,
        COALESCE(
          pr.name,
          CASE
            WHEN h.game_type = 'mines' THEN
              CASE
                WHEN (h.result_data->>'amount')::float > 0 THEN 'Mines: Выигрыш ' || COALESCE(h.result_data->>'amount', '0') || ' ₽'
                ELSE 'Mines: Ставка ' || ABS(COALESCE(h.result_data->>'amount', '0')::float) || ' ₽'
              END
            WHEN h.game_type = 'rocket' THEN
              CASE
                WHEN (h.result_data->>'amount')::float > 0 THEN 'Rocket: Выигрыш ' || COALESCE(h.result_data->>'amount', '0') || ' ₽'
                ELSE 'Rocket: Ставка ' || ABS(COALESCE(h.result_data->>'amount', '0')::float) || ' ₽'
              END
            WHEN h.game_type = 'dice' THEN 'Кости: Сумма ' || COALESCE(h.result_data->'diceResult'->>'sum', '?') || ' (' || COALESCE(h.result_data->'diceResult'->>'d1', '?') || ':' || COALESCE(h.result_data->'diceResult'->>'d2', '?') || ')'
            WHEN h.game_type = 'safe' THEN 'Сейф: Неверный код (' || COALESCE(h.result_data->>'selectedCode', '?') || ')'
            WHEN h.game_type = 'cards' THEN 'Карты: Проигрыш'
            WHEN h.game_type = 'flappy' THEN 'Flappy: Счет ' || COALESCE(h.result_data->>'score', '0')
            WHEN h.game_type LIKE 'TOPUP%' THEN 'Пополнение: ' || COALESCE(h.result_data->>'amount', '0') || ' ₽'
            WHEN h.game_type LIKE 'SERVICE_AWARD%' THEN COALESCE(h.result_data->>'rule_name', 'Начисление услуг')
            WHEN h.game_type = 'BAR_BONUS_PURCHASE' THEN 'Покупка в баре: ' || COALESCE(h.result_data->>'bonus_cost', '0') || ' 🪙'
            WHEN h.game_type = 'WITHDRAW' THEN 'Вывод: ' || COALESCE(h.result_data->>'amount', '0') || ' ₽'
            WHEN h.game_type = 'QUEST_REWARD' THEN 'Награда за квест'
            ELSE 'Проигрыш'
          END
        ) as prize_name,

        COALESCE(
          pr.type,
          CASE
            WHEN h.game_type = 'mines' OR h.game_type = 'rocket' THEN
              CASE WHEN (h.result_data->>'amount')::float > 0 THEN 'virtual' ELSE 'bet' END
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
       WHERE h.club_id = $1`;
    
    const gameParams: any[] = [clubId];
    if (playerId) {
      gameQuery += ` AND h.player_id = $2`;
      gameParams.push(playerId);
    }
    gameQuery += ` ORDER BY h.created_at DESC LIMIT 200`;

    const gameLogs = await query(gameQuery, gameParams);

    // 3. Stats for today
    const stats = await query(
      `SELECT
        (SELECT COUNT(*) FROM promo_tickets WHERE club_id = $1 AND created_at >= CURRENT_DATE) as tickets_issued_today,
        (SELECT COUNT(*) FROM promo_history WHERE club_id = $1 AND created_at >= CURRENT_DATE AND game_type NOT IN ('TOPUP', 'WITHDRAW', 'SERVICE_AWARD', 'BAR_BONUS_PURCHASE')) as games_played_today,
        (SELECT COALESCE(SUM(pr.value), 0) FROM promo_history h JOIN promo_prizes pr ON h.prize_id = pr.id WHERE h.club_id = $1 AND h.created_at >= CURRENT_DATE AND pr.type = 'virtual')
        + (SELECT COALESCE(SUM((result_data->>'amount')::float), 0) FROM promo_history WHERE club_id = $1 AND created_at >= CURRENT_DATE AND game_type IN ('mines', 'rocket')) as prize_money_today,
        (SELECT COALESCE(SUM(pr.value), 0) FROM promo_history h JOIN promo_prizes pr ON h.prize_id = pr.id WHERE h.club_id = $1 AND h.created_at >= date_trunc('month', CURRENT_DATE) AND pr.type = 'virtual')
        + (SELECT COALESCE(SUM((result_data->>'amount')::float), 0) FROM promo_history WHERE club_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE) AND game_type IN ('mines', 'rocket')) as prize_money_month,

        (SELECT COALESCE(SUM(withdraw_amount), 0) FROM promo_prize_queue WHERE club_id = $1 AND status != 'canceled' AND created_at >= CURRENT_DATE)
        + (SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE' AND created_at >= CURRENT_DATE) as bonuses_used_today,
        (SELECT COALESCE(SUM(withdraw_amount), 0) FROM promo_prize_queue WHERE club_id = $1 AND status != 'canceled' AND created_at >= date_trunc('month', CURRENT_DATE))
        + (SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE' AND created_at >= date_trunc('month', CURRENT_DATE)) as bonuses_used_month,
        
        (SELECT COALESCE(SUM(withdraw_amount), 0) FROM promo_prize_queue WHERE club_id = $1 AND status != 'canceled' AND created_at >= CURRENT_DATE) as withdraws_today,
        (SELECT COALESCE(SUM(withdraw_amount), 0) FROM promo_prize_queue WHERE club_id = $1 AND status != 'canceled' AND created_at >= date_trunc('month', CURRENT_DATE)) as withdraws_month,
        
        (SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE' AND created_at >= CURRENT_DATE) as bar_bonus_retail_today,
        (SELECT COALESCE(SUM((result_data->>'bonus_cost')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE' AND created_at >= date_trunc('month', CURRENT_DATE)) as bar_bonus_retail_month,
        
        (SELECT COALESCE(SUM((SELECT SUM(ri.quantity * ri.cost_price_snapshot) FROM shift_receipt_items ri WHERE ri.receipt_id = (h.result_data->>'receipt_id')::int)), 0) FROM promo_history h WHERE h.club_id = $1 AND h.game_type = 'BAR_BONUS_PURCHASE' AND h.created_at >= CURRENT_DATE) as bar_bonus_cost_today,
        (SELECT COALESCE(SUM((SELECT SUM(ri.quantity * ri.cost_price_snapshot) FROM shift_receipt_items ri WHERE ri.receipt_id = (h.result_data->>'receipt_id')::int)), 0) FROM promo_history h WHERE h.club_id = $1 AND h.game_type = 'BAR_BONUS_PURCHASE' AND h.created_at >= date_trunc('month', CURRENT_DATE)) as bar_bonus_cost_month,

        (SELECT ABS(COALESCE(SUM((result_data->>'amount')::float), 0)) FROM promo_history WHERE club_id = $1 AND game_type IN ('mines', 'rocket') AND (result_data->>'amount')::float < 0 AND created_at >= CURRENT_DATE) as betting_losses_today,
        (SELECT ABS(COALESCE(SUM((result_data->>'amount')::float), 0)) FROM promo_history WHERE club_id = $1 AND game_type IN ('mines', 'rocket') AND (result_data->>'amount')::float < 0 AND created_at >= date_trunc('month', CURRENT_DATE)) as betting_losses_month,

        (SELECT COALESCE(SUM(bonus_balance), 0) FROM promo_player_balances WHERE club_id = $1) as total_bonus_debt,

        (SELECT COALESCE(SUM((result_data->>'amount')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'TOPUP' AND created_at >= CURRENT_DATE) as real_topup_today,
        (SELECT COALESCE(SUM((result_data->>'amount')::float), 0) FROM promo_history WHERE club_id = $1 AND game_type = 'TOPUP' AND created_at >= date_trunc('month', CURRENT_DATE)) as real_topup_month,
        (SELECT COUNT(DISTINCT player_id) FROM promo_history WHERE club_id = $1 AND created_at >= CURRENT_DATE) as active_players_today
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
