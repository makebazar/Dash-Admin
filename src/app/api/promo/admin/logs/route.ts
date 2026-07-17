import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const playerId = searchParams.get("playerId");
    const logType = searchParams.get("logType"); // 'issuance' or 'games'
    const search = searchParams.get("search");
    const gameType = searchParams.get("gameType");
    const dateFilter = searchParams.get("dateFilter"); // 'today', 'yesterday', 'week', 'month', 'all'
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine date filter boundaries
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      if (dateFilter === "today") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === "yesterday") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === "week") {
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === "month") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    // CASE 1: Fetch paginated Ticket Issuance logs
    if (logType === "issuance") {
      let countWhere = `t.club_id = $1`;
      const countParams: any[] = [clubId];

      if (playerId) {
        countWhere += ` AND t.player_id = $${countParams.length + 1}`;
        countParams.push(playerId);
      }
      if (search) {
        countWhere += ` AND (p.full_name ILIKE $${countParams.length + 1} OR p.phone_number LIKE $${countParams.length + 1})`;
        countParams.push(`%${search}%`);
      }
      if (dateFrom) {
        countWhere += ` AND t.created_at >= $${countParams.length + 1}`;
        countParams.push(dateFrom);
      }
      if (dateTo) {
        countWhere += ` AND t.created_at < $${countParams.length + 1}`;
        countParams.push(dateTo);
      }

      const countQuery = `
        SELECT COUNT(*)::int as count FROM (
          SELECT 1
          FROM promo_tickets t
          JOIN promo_players p ON t.player_id = p.id
          LEFT JOIN promo_history h ON t.history_id = h.id
          WHERE ${countWhere}
          GROUP BY p.full_name, p.phone_number, t.source, t.created_at, t.player_id, t.history_id, h.game_type, h.result_data::text
        ) as grouped_tickets
      `;
      const countRes = await query(countQuery, countParams);
      const total = countRes.rows[0]?.count || 0;

      const dataParams = [...countParams];
      const dataLimit = limit ? parseInt(limit) : 50;
      const dataOffset = offset ? parseInt(offset) : 0;
      dataParams.push(dataLimit, dataOffset);

      const issuanceQuery = `
        SELECT
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
        WHERE ${countWhere}
        GROUP BY p.full_name, p.phone_number, t.source, t.created_at, t.player_id, t.history_id, h.game_type, h.result_data::text
        ORDER BY t.created_at DESC 
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;
      const dataRes = await query(issuanceQuery, dataParams);

      return NextResponse.json({
        success: true,
        logs: dataRes.rows,
        total,
      });
    }

    // CASE 2: Fetch paginated Game history logs
    if (logType === "games") {
      let countWhere = `h.club_id = $1`;
      const countParams: any[] = [clubId];

      if (playerId) {
        countWhere += ` AND h.player_id = $${countParams.length + 1}`;
        countParams.push(playerId);
      }
      if (search) {
        countWhere += ` AND (p.full_name ILIKE $${countParams.length + 1} OR p.phone_number LIKE $${countParams.length + 1})`;
        countParams.push(`%${search}%`);
      }
      if (gameType && gameType !== "all") {
        if (gameType === "games_tickets") {
          countWhere += ` AND h.game_type IN ('wheel', 'safe', 'dice', 'cards', 'flappy')`;
        } else if (gameType === "games_bets") {
          countWhere += ` AND h.game_type IN ('mines', 'rocket')`;
        } else if (gameType === "cases") {
          countWhere += ` AND h.game_type IN ('CASE_OPEN', 'CASE_REFUND')`;
        } else if (gameType === "transactions") {
          countWhere += ` AND h.game_type IN ('TOPUP', 'SERVICE_AWARD', 'BAR_BONUS_PURCHASE', 'WITHDRAW', 'QUEST_REWARD', 'frag')`;
        } else if (gameType === "other_games") {
          countWhere += ` AND h.game_type NOT IN ('TOPUP', 'WITHDRAW', 'SERVICE_AWARD', 'BAR_BONUS_PURCHASE')`;
        } else if (gameType === "rewards") {
          countWhere += ` AND h.game_type IN ('TOPUP', 'SERVICE_AWARD', 'QUEST_REWARD', 'frag')`;
        } else {
          countWhere += ` AND h.game_type = $${countParams.length + 1}`;
          countParams.push(gameType);
        }
      }
      if (dateFrom) {
        countWhere += ` AND h.created_at >= $${countParams.length + 1}`;
        countParams.push(dateFrom);
      }
      if (dateTo) {
        countWhere += ` AND h.created_at < $${countParams.length + 1}`;
        countParams.push(dateTo);
      }

      const countQuery = `
        SELECT COUNT(*)::int as count
        FROM promo_history h
        JOIN promo_players p ON h.player_id = p.id
        LEFT JOIN promo_prizes pr ON h.prize_id = pr.id
        WHERE ${countWhere}
      `;
      const countRes = await query(countQuery, countParams);
      const total = countRes.rows[0]?.count || 0;

      const dataParams = [...countParams];
      const dataLimit = limit ? parseInt(limit) : 50;
      const dataOffset = offset ? parseInt(offset) : 0;
      dataParams.push(dataLimit, dataOffset);

      const gameQuery = `
        SELECT
          h.id,
          p.full_name as player_name,
          p.phone_number as player_phone,
          h.game_type,
          pr.value as prize_value,
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
              WHEN h.game_type = 'CASE_OPEN' THEN 'Кейс: ' || COALESCE(h.result_data->>'case_name', 'Без названия') || ' (Выпал: ' || COALESCE(h.result_data->>'won_item_name', '?') || ')'
              WHEN h.game_type = 'CASE_REFUND' THEN 'Возврат за кэйс: ' || COALESCE(h.result_data->>'case_name', 'Без названия')
              WHEN h.game_type = 'frag' THEN 'Зачисление за матч ' || COALESCE(h.result_data->>'game', '') || ' (' || COALESCE(h.result_data->>'score', '') || ')'
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
              WHEN h.game_type = 'CASE_OPEN' THEN 'case'
              WHEN h.game_type = 'CASE_REFUND' THEN 'refund'
              WHEN h.game_type = 'frag' THEN 'virtual'
              ELSE 'other'
            END
          ) as prize_type,
          h.result_data,
          h.created_at
        FROM promo_history h
        JOIN promo_players p ON h.player_id = p.id
        LEFT JOIN promo_prizes pr ON h.prize_id = pr.id
        WHERE ${countWhere}
        ORDER BY h.created_at DESC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
      `;
      const dataRes = await query(gameQuery, dataParams);

      return NextResponse.json({
        success: true,
        logs: dataRes.rows,
        total,
      });
    }

    // CASE 3: Legacy GET handler (return all data for initial load)
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

    let gameQuery = `SELECT
        h.id,
        p.full_name as player_name,
        p.phone_number as player_phone,
        h.game_type,
        pr.value as prize_value,
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
            WHEN h.game_type = 'CASE_OPEN' THEN 'Кейс: ' || COALESCE(h.result_data->>'case_name', 'Без названия') || ' (Выпал: ' || COALESCE(h.result_data->>'won_item_name', '?') || ')'
            WHEN h.game_type = 'CASE_REFUND' THEN 'Возврат за кэйс: ' || COALESCE(h.result_data->>'case_name', 'Без названия')
            WHEN h.game_type = 'frag' THEN 'Зачисление за матч ' || COALESCE(h.result_data->>'game', '') || ' (' || COALESCE(h.result_data->>'score', '') || ')'
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
            WHEN h.game_type = 'CASE_OPEN' THEN 'case'
            WHEN h.game_type = 'CASE_REFUND' THEN 'refund'
            WHEN h.game_type = 'frag' THEN 'virtual'
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

    let inventory: any[] = [];
    let loyalty: any = null;
    let quests: any[] = [];

    if (playerId) {
      const invRes = await query(
        `SELECT i.id, i.status, i.created_at, i.activated_at, i.claimed_at, i.bar_product_id,
                COALESCE(p.name, ci.name) as name, 
                ci.description, ci.reward_type, 
                COALESCE(p.selling_price, ci.reward_value) as reward_value, 
                ci.image_url, ci.is_rare,
                q.id as queue_id, q.status as queue_status
         FROM promo_player_inventory i
         JOIN promo_case_items ci ON i.item_id = ci.id
         LEFT JOIN warehouse_products p ON i.bar_product_id = p.id
         LEFT JOIN promo_prize_queue q ON q.inventory_item_id = i.id
         WHERE i.player_id = $1 AND i.club_id = $2
         ORDER BY i.created_at DESC`,
        [playerId, parseInt(clubId)]
      );
      inventory = invRes.rows;

      const loyaltyRes = await query(
        `SELECT program_id, current_count, last_event_date
         FROM promo_package_progress
         WHERE player_id = $1 AND club_id = $2`,
        [playerId, parseInt(clubId)]
      );

      let accumulated_packages = 0;
      let accumulated_visits = 0;
      let current_streak = 0;
      let last_purchase_date = null;
      let last_visit_date = null;

      for (const row of loyaltyRes.rows) {
        if (row.program_id === "legacy_packages" || row.program_id === "legacy") {
          accumulated_packages = row.current_count;
          last_purchase_date = row.last_event_date;
        } else if (row.program_id === "legacy_visits") {
          accumulated_visits = row.current_count;
          last_visit_date = row.last_event_date;
        } else if (row.program_id === "legacy_streak") {
          current_streak = row.current_count;
        }
      }

      loyalty = {
        accumulated_packages,
        accumulated_visits,
        current_streak,
        last_purchase_date,
        last_visit_date,
      };

      const questsRes = await query(
        `SELECT pq.id, pq.current_progress, pq.status, pq.expires_at, pq.completed_at, pq.verification_photo_url, pq.seat_number, pq.assigned_at,
                q.title as quest_title, q.description as quest_description, q.target_value, q.reward_xp, q.reward_tickets, q.reward_bonus_balance
         FROM promo_player_quests pq
         JOIN promo_quests q ON pq.quest_id = q.id
         WHERE pq.player_id = $1 AND pq.club_id = $2
         ORDER BY pq.assigned_at DESC`,
        [playerId, parseInt(clubId)]
      );
      quests = questsRes.rows;
    }

    return NextResponse.json({
      success: true,
      issuanceLogs: issuanceLogs.rows,
      gameLogs: gameLogs.rows,
      stats: stats.rows[0],
      inventory,
      loyalty,
      quests,
    });
  } catch (error) {
    console.error("Fetch Logs Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
