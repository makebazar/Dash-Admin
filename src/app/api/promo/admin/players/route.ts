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
          SELECT SUM(COALESCE((result_data->>'amount')::numeric, (result_data->>'bonus_cost')::numeric, 0))
          FROM promo_history
          WHERE player_id = p.id AND club_id = $1 AND game_type IN ('WITHDRAW', 'BAR_BONUS_PURCHASE')
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

    return NextResponse.json({ players: result.rows, total });
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
