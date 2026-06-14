import { NextResponse } from "next/server";
import { getClient, query } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  let client;
  try {
    const { inventoryId, clubId } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!inventoryId || !clubId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    client = await getClient();
    await client.query("BEGIN");

    // 1. Fetch inventory item details
    const invRes = await client.query(
      `SELECT id, player_id, status, item_id 
       FROM promo_player_inventory 
       WHERE id = $1 AND club_id = $2 FOR UPDATE`,
      [inventoryId, parseInt(clubId)]
    );

    if (invRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    const invItem = invRes.rows[0];

    if (invItem.status === "claimed") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item has already been claimed and cannot be refunded" }, { status: 400 });
    }

    if (invItem.status === "refunded") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item is already refunded" }, { status: 400 });
    }

    // 2. Find case opening cost from history
    const historyRes = await client.query(
      `SELECT result_data 
       FROM promo_history 
       WHERE player_id = $1 AND club_id = $2 AND game_type = 'CASE_OPEN' 
         AND (result_data->>'inventory_id') = $3
       LIMIT 1`,
      [invItem.player_id, parseInt(clubId), inventoryId]
    );

    let refundCost = 0;
    let caseName = "Неизвестный кейс";
    let itemName = "Неизвестный предмет";

    if (historyRes.rows.length > 0) {
      const resultData = historyRes.rows[0].result_data || {};
      refundCost = parseFloat(resultData.cost || 0);
      caseName = resultData.case_name || caseName;
      itemName = resultData.won_item_name || itemName;
    } else {
      // Fallback: look up the price in the case configuration if log is missing
      const itemConfigRes = await client.query(
        `SELECT ci.name, c.price_bonus 
         FROM promo_case_items ci
         JOIN promo_cases c ON ci.case_id = c.id
         WHERE ci.id = $1`,
        [invItem.item_id]
      );
      if (itemConfigRes.rows.length > 0) {
        refundCost = parseFloat(itemConfigRes.rows[0].price_bonus || 0);
        itemName = itemConfigRes.rows[0].name || itemName;
      }
    }

    console.log(`Refunding inventory item ${inventoryId}. Cost: ${refundCost} ₽, Player: ${invItem.player_id}`);

    // 3. Mark inventory item as refunded
    await client.query(
      `UPDATE promo_player_inventory 
       SET status = 'refunded', claimed_at = NOW() 
       WHERE id = $1`,
      [inventoryId]
    );

    // 4. Cancel queue item if it was activated
    if (invItem.status === "activated") {
      await client.query(
        `UPDATE promo_prize_queue 
         SET status = 'canceled', claimed_at = NOW(), claimed_by_admin_id = $1 
         WHERE inventory_item_id = $2`,
        [userId, inventoryId]
      );
      await query(`SELECT pg_notify('promo_queue_updates', $1)`, [parseInt(clubId)]);
    }

    // 5. Refund the cost back to the player's balance
    if (refundCost > 0) {
      await client.query(
        `UPDATE promo_player_balances 
         SET bonus_balance = bonus_balance + $1, updated_at = NOW() 
         WHERE player_id = $2 AND club_id = $3`,
        [refundCost, invItem.player_id, parseInt(clubId)]
      );

      // Log refund history
      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'CASE_REFUND', $3)`,
        [
          invItem.player_id,
          parseInt(clubId),
          JSON.stringify({
            inventory_id: inventoryId,
            case_name: caseName,
            item_name: itemName,
            amount: refundCost,
          }),
        ]
      );
    }

    await client.query("COMMIT");

    // SSE notification
    try {
      const { notifyInventoryClub } = await import("@/lib/inventory-events");
      notifyInventoryClub(String(clubId), {
        type: "PROMO_QUEUE_UPDATED",
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send SSE event for refund:", e);
    }

    return NextResponse.json({ success: true, refundedAmount: refundCost });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Admin Refund Inventory Item Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
