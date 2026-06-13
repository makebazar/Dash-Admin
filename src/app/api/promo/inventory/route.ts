import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const clubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await query(
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

    return NextResponse.json({ inventory: result.rows });
  } catch (error) {
    console.error("Player Fetch Inventory Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let client;
  try {
    const { inventoryId } = await request.json();
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const clubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !clubId || !inventoryId) {
      return NextResponse.json({ error: "Unauthorized or missing parameters" }, { status: 401 });
    }

    client = await getClient();
    await client.query("BEGIN");

    const invRes = await client.query(
      `SELECT i.id, i.status, i.item_id, i.bar_product_id as resolved_bar_product_id, 
              ci.name, ci.reward_type, ci.reward_value, ci.bar_product_id as config_bar_product_id
       FROM promo_player_inventory i
       JOIN promo_case_items ci ON i.item_id = ci.id
       WHERE i.id = $1 AND i.player_id = $2 AND i.club_id = $3
       FOR UPDATE`,
      [inventoryId, playerId, parseInt(clubId)]
    );

    if (invRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    const item = invRes.rows[0];

    if (item.status !== "acquired") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item is already activated or claimed" }, { status: 400 });
    }

    const rewardType = item.reward_type;
    const rewardValue = parseFloat(item.reward_value);
    const finalProductId = item.resolved_bar_product_id || item.config_bar_product_id || null;

    if (rewardType === "bonus_limitless") {
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = bonus_balance + $1,
             extra_withdraw_limit = extra_withdraw_limit + $1,
             updated_at = NOW()
         WHERE player_id = $2 AND club_id = $3`,
        [rewardValue, playerId, parseInt(clubId)]
      );

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'claimed', activated_at = NOW(), claimed_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_LIMITLESS', $3)`,
        [playerId, parseInt(clubId), JSON.stringify({ amount: rewardValue, inventory_id: inventoryId })]
      );

    } else if (rewardType === "bonus_standard") {
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = bonus_balance + $1,
             updated_at = NOW()
         WHERE player_id = $2 AND club_id = $3`,
        [rewardValue, playerId, parseInt(clubId)]
      );

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'claimed', activated_at = NOW(), claimed_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_STANDARD', $3)`,
        [playerId, parseInt(clubId), JSON.stringify({ amount: rewardValue, inventory_id: inventoryId })]
      );

    } else if (rewardType === "bp_xp") {
      const { addPlayerXP } = await import("@/lib/promo-quests");
      await addPlayerXP(client, parseInt(clubId), playerId, Math.floor(rewardValue));

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'claimed', activated_at = NOW(), claimed_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_XP', $3)`,
        [playerId, parseInt(clubId), JSON.stringify({ xp: rewardValue, inventory_id: inventoryId })]
      );

    } else if (rewardType === "xp_boost" || rewardType === "withdraw_boost") {
      // Both keys update active_boost_percent in database
      await client.query(
        `UPDATE promo_player_balances
         SET active_boost_percent = active_boost_percent + $1,
             updated_at = NOW()
         WHERE player_id = $2 AND club_id = $3`,
        [Math.floor(rewardValue), playerId, parseInt(clubId)]
      );

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'claimed', activated_at = NOW(), claimed_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_BOOST', $3)`,
        [playerId, parseInt(clubId), JSON.stringify({ boost: rewardValue, inventory_id: inventoryId })]
      );

    } else if (rewardType === "ticket") {
      // Claim ticket
      await client.query(
        `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
         SELECT $1::uuid, $2::int, 'available', 'case_reward', NULL
         FROM generate_series(1, $3)`,
        [playerId, parseInt(clubId), Math.floor(rewardValue)]
      );

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'claimed', activated_at = NOW(), claimed_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_TICKET', $3)`,
        [playerId, parseInt(clubId), JSON.stringify({ tickets: rewardValue, inventory_id: inventoryId })]
      );

    } else if (rewardType === "bar_item" || rewardType === "bar_category" || rewardType === "club_service" || rewardType === "club_time" || rewardType === "custom") {
      // Fetch resolved name for random category drops to put into cashier queue
      let rewardName = item.name;
      if (rewardType === "bar_category" && finalProductId) {
        const prodRes = await client.query(`SELECT name FROM products WHERE id = $1`, [finalProductId]);
        if (prodRes.rows.length > 0) {
          rewardName = prodRes.rows[0].name;
        }
      }

      const histRes = await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'INVENTORY_USE_PHYSICAL', $3)
         RETURNING id`,
        [playerId, parseInt(clubId), JSON.stringify({ reward_type: rewardType, name: rewardName, inventory_id: inventoryId })]
      );
      const historyId = histRes.rows[0].id;

      // Determine prize type label for the queue
      let qPrizeType = "physical";
      let deductInventory = false;
      if (rewardType === "bar_item" || rewardType === "bar_category") {
        qPrizeType = "bar_item";
        deductInventory = true;
      } else if (rewardType === "club_service") {
        qPrizeType = "club_service";
      }

      await client.query(
        `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status, prize_type, custom_reward_name, bar_product_id, reward_value, inventory_item_id, deduct_inventory)
         VALUES ($1, $2, $3, NULL, 'pending', $4, $5, $6, $7, $8, $9)`,
        [
          historyId,
          playerId,
          parseInt(clubId),
          qPrizeType,
          rewardName,
          finalProductId,
          rewardValue,
          inventoryId,
          deductInventory
        ]
      );

      await client.query(
        `UPDATE promo_player_inventory
         SET status = 'activated', activated_at = NOW()
         WHERE id = $1`,
        [inventoryId]
      );

      await client.query(`SELECT pg_notify('promo_queue_updates', $1)`, [parseInt(clubId)]);

      try {
        const { notifyInventoryClub } = await import("@/lib/inventory-events");
        notifyInventoryClub(String(clubId), {
          type: "PROMO_QUEUE_UPDATED",
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error("[SSE] Failed to send SSE event inside inventory activate:", e);
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Player Use Inventory Item Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
