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
          COUNT(*)::int as count,
          MAX(expires_at) as expires_at
        FROM promo_tickets
        WHERE player_id = $1 AND club_id = $2
        GROUP BY source, created_at
      )
      SELECT
        tb.*,
        (
          SELECT string_agg(p.name || ' x' || i.quantity, ', ')
          FROM shift_receipts r
          JOIN shift_receipt_items i ON i.receipt_id = r.id
          JOIN warehouse_products p ON p.id = i.product_id
          WHERE r.promo_player_id = $1
            AND r.created_at BETWEEN tb.created_at - interval '5 seconds' AND tb.created_at + interval '5 seconds'
          GROUP BY r.id
          LIMIT 1
        ) as bar_products,
        (
          SELECT result_data->>'amount'
          FROM promo_history ph
          WHERE ph.player_id = $1
            AND ph.game_type = 'TOPUP'
            AND ph.created_at BETWEEN tb.created_at - interval '5 seconds' AND tb.created_at + interval '5 seconds'
          LIMIT 1
        ) as topup_amount
      FROM ticket_batches tb
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
