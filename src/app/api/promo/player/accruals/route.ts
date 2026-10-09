import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get ticket issuance history (group by source and date for better UI)
    // We'll use the created_at and source to show when and why tickets were given.
    // Note: Since promo_tickets doesn't have a "batch_id", we'll group by source and a timestamp window or just list them.
    // Let's just list the most recent batches.

    const result = await query(
      `WITH ticket_batches AS (
        SELECT
          source,
          created_at,
          history_id,
          COUNT(*)::int as count,
          MAX(expires_at) as expires_at
        FROM promo_tickets
        WHERE player_id = $1 AND club_id = $2
        GROUP BY source, created_at, history_id
      )
      SELECT
        tb.*,
        ph.result_data,
        ph.game_type,
        COALESCE(
          ph.result_data->>'packages_summary',
          ph.result_data->>'tariff_name',
          (
            SELECT elem->>'title'
            FROM jsonb_array_elements(COALESCE(ph.result_data->'packages', '[]'::jsonb)) elem
            LIMIT 1
          )
        ) as tariff_name,
        COALESCE(
          ph.result_data->>'bar_products',
          (
            SELECT string_agg(p.name || ' x' || i.quantity, ', ')
            FROM shift_receipts r
            JOIN shift_receipt_items i ON i.receipt_id = r.id
            JOIN warehouse_products p ON p.id = i.product_id
            WHERE r.promo_player_id = $1
              AND r.created_at BETWEEN tb.created_at - interval '15 seconds' AND tb.created_at + interval '15 seconds'
            GROUP BY r.id
            LIMIT 1
          )
        ) as bar_products,
        COALESCE(
          (ph.result_data->>'amount')::numeric,
          (
            SELECT (h.result_data->>'amount')::numeric
            FROM promo_history h
            WHERE h.player_id = $1 AND h.club_id = $2
              AND h.created_at BETWEEN tb.created_at - interval '15 seconds' AND tb.created_at + interval '15 seconds'
              AND h.result_data->>'amount' IS NOT NULL
            ORDER BY h.created_at DESC
            LIMIT 1
          )
        ) as topup_amount,
        COALESCE(
          ph.result_data->>'method',
          (
            SELECT h.result_data->>'method'
            FROM promo_history h
            WHERE h.player_id = $1 AND h.club_id = $2
              AND h.created_at BETWEEN tb.created_at - interval '15 seconds' AND tb.created_at + interval '15 seconds'
              AND h.result_data->>'method' IS NOT NULL
            ORDER BY h.created_at DESC
            LIMIT 1
          )
        ) as payment_method,
        (
          SELECT q.title 
          FROM promo_player_quests pq
          JOIN promo_quests q ON q.id = pq.quest_id
          WHERE pq.player_id = $1
            AND pq.completed_at BETWEEN tb.created_at - interval '15 seconds' AND tb.created_at + interval '15 seconds'
          ORDER BY pq.completed_at DESC
          LIMIT 1
        ) as quest_title,
        (
          SELECT COALESCE(
            NULLIF(q.description, ''),
            CASE 
              WHEN q.trigger_type = 'balance_topup' THEN 'Пополнение баланса от ' || trim(to_char(q.target_value::numeric, 'FM999G999G999')) || ' ₽'
              WHEN q.trigger_type = 'package_buy' THEN 'Покупка игровых пакетов/тарифов'
              WHEN q.trigger_type = 'bar_buy' THEN 'Покупка товаров в баре'
              WHEN q.trigger_type = 'visit_streak' THEN 'Серия посещений клуба'
              ELSE NULL
            END
          )
          FROM promo_player_quests pq
          JOIN promo_quests q ON q.id = pq.quest_id
          WHERE pq.player_id = $1
            AND pq.completed_at BETWEEN tb.created_at - interval '15 seconds' AND tb.created_at + interval '15 seconds'
          ORDER BY pq.completed_at DESC
          LIMIT 1
        ) as quest_description,
        COALESCE(
          ph.result_data->>'quest_title',
          ph.result_data->>'description',
          ph.result_data->>'notes',
          ph.result_data->>'reason'
        ) as detail_text
      FROM ticket_batches tb
      LEFT JOIN promo_history ph ON ph.id = tb.history_id
      ORDER BY tb.created_at DESC
      LIMIT 50`,
      [playerId, activeClubId],
    );

    return NextResponse.json({ accruals: result.rows });
  } catch (error) {
    console.error("Fetch Accruals History Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
