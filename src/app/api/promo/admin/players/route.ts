import { NextResponse } from "next/server";
import { query, queryClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const phone = searchParams.get("phone");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch club settings to get targets & limits configuration
    const clubResult = await query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [clubId],
    );
    const promoSettings = clubResult.rows[0]?.promo_settings || {};

    let whereClause = "";
    const params: any[] = [clubId];

    if (phone) {
      if (phone.length < 4) {
        return NextResponse.json({ players: [], total: 0 });
      }
      whereClause = "AND p.phone_number LIKE $2";
      params.push(`%${phone}%`);
    } else if (search) {
      whereClause = "AND (p.phone_number LIKE $2 OR p.full_name ILIKE $2)";
      params.push(`%${search}%`);
    }

    // Calculate total count first
    const countResult = await query(
      `SELECT COUNT(*)::int as count
       FROM promo_players p
       JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $1
       WHERE 1=1 ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.count || 0;

    let limitClause = "LIMIT 50";
    if (limitParam) {
      const nextParamIndex = params.length + 1;
      limitClause = `LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`;
      params.push(parseInt(limitParam));
      params.push(parseInt(offsetParam || "0"));
    }

    const result = await query(
      `SELECT
        p.id,
        p.phone_number,
        p.full_name,
        COALESCE(b.total_xp, 0) as total_xp,
        COALESCE(b.bonus_balance, 0) as bonus_balance,
        b.limit_group_id,
        COALESCE(b.extra_withdraw_limit, 0) as extra_withdraw_limit,
        COALESCE((
          SELECT SUM((result_data->>'amount')::numeric)
          FROM promo_history
          WHERE player_id = p.id AND club_id = $1 AND game_type = 'TOPUP' AND created_at >= date_trunc('month', CURRENT_DATE)
        ), 0) + COALESCE((
          SELECT SUM(total_amount)
          FROM shift_receipts
          WHERE promo_player_id = p.id AND club_id = $1 AND payment_type IN ('cash', 'card', 'mixed') AND committed_at >= date_trunc('month', CURRENT_DATE)
        ), 0) as monthly_topups,
        COALESCE((
          SELECT SUM(withdraw_amount)
          FROM promo_prize_queue
          WHERE player_id = p.id AND club_id = $1 AND status != 'canceled' AND created_at >= date_trunc('month', CURRENT_DATE)
        ), 0) + COALESCE((
          SELECT SUM((result_data->>'bonus_cost')::numeric)
          FROM promo_history
          WHERE player_id = p.id AND club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE' AND created_at >= date_trunc('month', CURRENT_DATE)
        ), 0) as monthly_withdrawn,
        (SELECT COUNT(*)::int FROM promo_tickets t WHERE t.player_id = p.id AND t.club_id = $1 AND t.status = 'available' AND (t.expires_at IS NULL OR t.expires_at > NOW())) as tickets_count,
        COALESCE((
          SELECT COUNT(*)::int
          FROM promo_tickets t
          WHERE t.player_id = p.id AND t.club_id = $1
        ), 0) as total_tickets_received,
        COALESCE((
          SELECT MAX(l.level_number)
          FROM promo_levels l
          WHERE l.club_id = $1 AND l.xp_required <= COALESCE(b.total_xp, 0)
        ), 1) as level,
        COALESCE((
          SELECT l.xp_required
          FROM promo_levels l
          WHERE l.club_id = $1 AND l.level_number = COALESCE((
            SELECT MAX(l2.level_number)
            FROM promo_levels l2
            WHERE l2.club_id = $1 AND l2.xp_required <= COALESCE(b.total_xp, 0)
          ), 1)
        ), 0) as current_level_xp,
        COALESCE((
          SELECT l.xp_required
          FROM promo_levels l
          WHERE l.club_id = $1 AND l.level_number = COALESCE((
            SELECT MAX(l2.level_number)
            FROM promo_levels l2
            WHERE l2.club_id = $1 AND l2.xp_required <= COALESCE(b.total_xp, 0)
          ), 1) + 1
        ), (
          SELECT MAX(xp_required) FROM promo_levels WHERE club_id = $1
        )) as next_level_xp,
        COALESCE((
          SELECT bp.has_premium
          FROM promo_bp_player_progress bp
          JOIN promo_bp_seasons s ON s.id = bp.season_id
          WHERE bp.player_id = p.id AND s.club_id = $1 AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date
          LIMIT 1
        ), FALSE) as bp_is_premium,
        COALESCE((
          SELECT SUM((result_data->>'amount')::numeric)
          FROM promo_history
          WHERE player_id = p.id AND club_id = $1 AND game_type IN ('TOPUP', 'SERVICE_AWARD')
        ), 0) as total_deposited,
        COALESCE((
          SELECT SUM(withdraw_amount)
          FROM promo_prize_queue
          WHERE player_id = p.id AND club_id = $1 AND status != 'canceled'
        ), 0) + COALESCE((
          SELECT SUM((result_data->>'bonus_cost')::numeric)
          FROM promo_history
          WHERE player_id = p.id AND club_id = $1 AND game_type = 'BAR_BONUS_PURCHASE'
        ), 0) as total_withdrawn,
        COALESCE((
          SELECT SUM((h.result_data->>'items_total')::numeric)
          FROM promo_history h
          WHERE h.player_id = p.id AND h.club_id = $1 AND h.game_type = 'BAR_BONUS_PURCHASE'
        ), 0) as bar_retail_total,
        COALESCE((
          SELECT SUM((
            SELECT SUM(ri.quantity * ri.cost_price_snapshot)
            FROM shift_receipt_items ri
            WHERE ri.receipt_id = (h.result_data->>'receipt_id')::int
          ))
          FROM promo_history h
          WHERE h.player_id = p.id AND h.club_id = $1 AND h.game_type = 'BAR_BONUS_PURCHASE'
        ), 0) as bar_cost_total
       FROM promo_players p
       JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $1
       WHERE 1=1 ${whereClause}
       ORDER BY p.created_at DESC
       ${limitClause}`,
      params,
    );

    // Calculate remaining limits in JS
    const playersWithLimits = result.rows.map(row => {
      let t1 = 1000;
      let t2 = 3000;
      let t3 = 5000;

      const limit_group_id = row.limit_group_id;
      if (limit_group_id && promoSettings.limit_groups && Array.isArray(promoSettings.limit_groups)) {
        const group = promoSettings.limit_groups.find((g: any) => g.id === limit_group_id);
        if (group) {
          t1 = parseFloat(group.t1) || 0;
          t2 = parseFloat(group.t2) || 0;
          t3 = parseFloat(group.t3) || 0;
        }
      }

      const monthlyTopups = parseFloat(row.monthly_topups || 0);

      let basePercent = 30;
      if (monthlyTopups > t3) {
        basePercent = 90;
      } else if (monthlyTopups > t2) {
        basePercent = 70;
      } else if (monthlyTopups > t1) {
        basePercent = 50;
      }

      let bpBoost = 15;
      if (promoSettings.withdraw_limit_percent_bp !== undefined && promoSettings.withdraw_limit_percent !== undefined) {
        bpBoost = Math.max(0, parseFloat(promoSettings.withdraw_limit_percent_bp) - parseFloat(promoSettings.withdraw_limit_percent));
      }
      
      const finalPercent = row.bp_is_premium ? Math.min(100, basePercent + bpBoost) : basePercent;

      const extraLimit = parseFloat(row.extra_withdraw_limit || 0);
      const monthlyWithdrawn = parseFloat(row.monthly_withdrawn || 0);

      const allowedLimit = (monthlyTopups * (finalPercent / 100)) + extraLimit;
      const remainingLimit = Math.max(0, allowedLimit - monthlyWithdrawn);

      return {
        ...row,
        allowed_withdraw_limit: allowedLimit,
        remaining_withdraw_limit: remainingLimit,
        withdraw_limit_enabled: promoSettings.withdraw_limit_enabled === true
      };
    });

    return NextResponse.json({ players: playersWithLimits, total });
  } catch (error) {
    console.error("Fetch Players Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { playerId, clubId, totalXp, bonusBalance, fullName, ticketsCount } =
      await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId || !playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await queryClient();
    try {
      await client.query("BEGIN");

      // 1. Update Profile (Name)
      if (fullName !== undefined) {
        await client.query(
          `UPDATE promo_players SET full_name = $1 WHERE id = $2`,
          [fullName, playerId],
        );
      }

      // 2. Update Balances (XP, Bonus)
      await client.query(
        `UPDATE promo_player_balances
         SET total_xp = $1, bonus_balance = $2, updated_at = NOW()
         WHERE player_id = $3 AND club_id = $4`,
        [totalXp, bonusBalance, playerId, clubId],
      );

      // 3. Update Tickets if provided
      if (ticketsCount !== undefined) {
        // Simple strategy: reset all available tickets and add new ones
        await client.query(
          `DELETE FROM promo_tickets
           WHERE player_id = $1 AND club_id = $2 AND status = 'available'`,
          [playerId, clubId],
        );

        if (ticketsCount > 0) {
          const expiryDate = new Date();
          expiryDate.setHours(expiryDate.getHours() + 24); // 24h tickets

          await client.query(
            `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
             SELECT $1, $2, 'available', 'admin_edit', $3
             FROM generate_series(1, $4)`,
            [playerId, clubId, expiryDate, Math.floor(ticketsCount)],
          );
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Update Player Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
