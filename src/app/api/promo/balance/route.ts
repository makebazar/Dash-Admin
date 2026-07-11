import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const client = await getClient();
  try {
    const { amount, reason } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (typeof amount !== "number") {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    await client.query("BEGIN");

    // Validation for win requests to prevent balance abuse
    // ponytail: relies on promo_history permanence to validate game sequences; if history is archived/cleared, this check will need a separate active_sessions table.
    const isWin = amount > 0;
    if (isWin) {
      const gameType = reason.split("_")[0] || "unknown";
      
      const lastActionRes = await client.query(
        `SELECT result_data FROM promo_history
         WHERE player_id = $1 AND club_id = $2 AND game_type = $3
         ORDER BY created_at DESC LIMIT 1`,
        [playerId, activeClubId, gameType]
      );
      
      const lastAction = lastActionRes.rows[0]?.result_data?.action;
      const expectedBetAction = `${gameType}_bet`;
      
      if (lastAction !== expectedBetAction) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Invalid game flow: expected ${expectedBetAction}, but last action was ${lastAction || 'none'}` },
          { status: 400 }
        );
      }
      
      const lastBetAmount = Math.abs(lastActionRes.rows[0]?.result_data?.amount || 0);
      if (lastBetAmount <= 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Invalid bet amount" }, { status: 400 });
      }
      
      // Maximum allowed win is 10000x the bet amount
      const maxAllowedWin = lastBetAmount * 10000;
      if (amount > maxAllowedWin) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Win amount exceeds maximum allowed multiplier. Max: ${maxAllowedWin}, Got: ${amount}` },
          { status: 400 }
        );
      }
    }

    // 1. Check if balance record exists and update it
    const updateResult = await client.query(
      `UPDATE promo_player_balances
       SET bonus_balance = bonus_balance + $1, updated_at = NOW()
       WHERE player_id = $2 AND club_id = $3
       RETURNING bonus_balance`,
      [amount, playerId, activeClubId],
    );

    if (updateResult.rowCount === 0) {
      // If it doesn't exist, try to create it (though it should exist if they are logged in)
      await client.query(
        `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, club_id)
         DO UPDATE SET bonus_balance = promo_player_balances.bonus_balance + $3, updated_at = NOW()`,
        [playerId, activeClubId, amount],
      );
    }

    // 2. Record in history
    const gameType = reason.split("_")[0] || "unknown";
    await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2, $3, $4)`,
      [
        playerId,
        activeClubId,
        gameType,
        JSON.stringify({
          action: reason,
          amount: amount,
          timestamp: new Date().toISOString(),
        }),
      ],
    );

    await client.query("COMMIT");

    const newBalance = updateResult.rows[0]?.bonus_balance || 0;

    return NextResponse.json({
      success: true,
      newBalance: parseFloat(newBalance),
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Promo Balance Update Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
