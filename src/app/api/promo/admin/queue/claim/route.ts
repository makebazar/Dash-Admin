import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  let client;
  try {
    const { id, itemId, action } = await request.json();
    const targetId = id || itemId;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!targetId) {
      return NextResponse.json({ error: "Missing queue item id" }, { status: 400 });
    }

    client = await getClient();
    await client.query("BEGIN");

    // 1. Fetch details of the queue item first with row lock
    const itemRes = await client.query(
      `SELECT player_id, club_id, withdraw_amount, status FROM promo_prize_queue WHERE id = $1 FOR UPDATE`,
      [targetId]
    );

    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = itemRes.rows[0];

    if (item.status !== "pending") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item is not in pending status" }, { status: 400 });
    }

    const status = action === "cancel" ? "canceled" : "claimed";

    // 2. Update queue entry
    await client.query(
      `UPDATE promo_prize_queue
       SET status = $1, claimed_at = NOW(), claimed_by_admin_id = $2
       WHERE id = $3`,
       [status, userId, targetId]
    );

    // 3. If canceled and it is a withdrawal, refund player balance
    if (action === "cancel" && item.withdraw_amount && parseFloat(item.withdraw_amount) > 0) {
      const refundAmount = parseFloat(item.withdraw_amount);
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = bonus_balance + $1, updated_at = NOW()
         WHERE player_id = $2 AND club_id = $3`,
        [refundAmount, item.player_id, item.club_id]
      );

      // Log a refund event in promo_history
      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'WITHDRAW_REFUND', $3)`,
        [item.player_id, item.club_id, JSON.stringify({ amount: refundAmount, original_queue_id: targetId })]
      );
    }

    await client.query("COMMIT");

    const clubId = item.club_id;
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [clubId]);

    // Notify via SSE for instant UI updates in cashier app
    try {
      const { notifyInventoryClub } = await import("@/lib/inventory-events");
      notifyInventoryClub(String(clubId), {
        type: "PROMO_QUEUE_UPDATED",
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send promo notification:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Claim Prize Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
