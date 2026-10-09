import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string; playerId: string }> }
) {
  const { clubId, playerId } = await params;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const body = await req.json();
    const { amount, reason } = body;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount === 0) {
      return NextResponse.json({ error: "Укажите корректную сумму очков" }, { status: 400 });
    }

    if (!reason || reason.trim() === "") {
      return NextResponse.json({ error: "Укажите причину корректировки" }, { status: 400 });
    }

    await client.query("BEGIN");

    // Update Bonus Balance (bonus_balance column in promo_player_balances)
    await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
       VALUES ($1, $2::int, $3::numeric)
       ON CONFLICT (player_id, club_id)
       DO UPDATE SET bonus_balance = COALESCE(promo_player_balances.bonus_balance, 0) + $3::numeric,
                     updated_at = NOW()`,
      [playerId, parseInt(clubId), numericAmount]
    );

    // Record in promo_history log
    await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2::int, 'MANUAL_POINT_ADJUSTMENT', $3)`,
      [
        playerId,
        parseInt(clubId),
        JSON.stringify({
          amount: numericAmount,
          reason: reason.trim(),
        }),
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("[Adjust Points Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
