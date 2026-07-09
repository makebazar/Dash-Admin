import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  let client;
  try {
    const { id, itemId, action, customAmount } = await request.json();
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
      `SELECT player_id, club_id, withdraw_amount, status, loyalty_type, reward_type, reward_value,
              prize_type, bar_product_id, deduct_inventory, inventory_item_id
       FROM promo_prize_queue WHERE id = $1 FOR UPDATE`,
      [targetId]
    );

    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = itemRes.rows[0];

    // Check admin access to the club
    try {
      const { requireClubApiAccess } = await import("@/lib/club-api-access");
      await requireClubApiAccess(String(item.club_id));
    } catch (e: any) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: e.message || "Forbidden" },
        { status: e.status || 403 }
      );
    }

    if (item.status !== "pending") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Item is not in pending status" }, { status: 400 });
    }

    const status = action === "cancel" ? "canceled" : "claimed";

    let finalWithdrawAmount = parseFloat(item.withdraw_amount || "0");
    let refundDiff = 0;

    if (action === "claim" && customAmount !== undefined && customAmount !== null) {
      const amountToClaim = parseFloat(String(customAmount));
      if (isNaN(amountToClaim) || amountToClaim < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Некорректная измененная сумма" }, { status: 400 });
      }
      if (amountToClaim > finalWithdrawAmount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Измененная сумма превышает запрошенную" }, { status: 400 });
      }
      refundDiff = finalWithdrawAmount - amountToClaim;
      finalWithdrawAmount = amountToClaim;
    }

    // 2. Update queue entry
    await client.query(
      `UPDATE promo_prize_queue
       SET status = $1, withdraw_amount = $2, claimed_at = NOW(), claimed_by_admin_id = $3
       WHERE id = $4`,
       [status, finalWithdrawAmount, userId, targetId]
    );

    if (refundDiff > 0) {
      // Refund the remaining difference to player's balance
      await client.query(
        `UPDATE promo_player_balances 
         SET bonus_balance = bonus_balance + $1, updated_at = NOW()
         WHERE player_id = $2 AND club_id = $3`,
        [refundDiff, item.player_id, item.club_id]
      );

      // Log refund
      await client.query(
        `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
         VALUES ($1, $2, 'WITHDRAW_REFUND', $3)`,
        [
          item.player_id,
          item.club_id,
          JSON.stringify({
            amount: refundDiff,
            original_queue_id: targetId,
            note: `Частичный вывод: запрошено ${item.withdraw_amount} ₽, выдано ${finalWithdrawAmount} ₽`
          })
        ]
      );
    }

    // Update linked inventory item status if exists
    if (item.inventory_item_id) {
      if (action === "claim") {
        await client.query(
          `UPDATE promo_player_inventory
           SET status = 'claimed', claimed_at = NOW()
           WHERE id = $1`,
          [item.inventory_item_id]
        );
      } else if (action === "cancel") {
        await client.query(
          `UPDATE promo_player_inventory
           SET status = 'acquired', activated_at = NULL
           WHERE id = $1`,
          [item.inventory_item_id]
        );
      }
    }

    // 3. If claimed and it is a loyalty reward, deduct counters and apply rewards
    if (action === "claim" && item.loyalty_type) {
      // Fetch club settings to get targets
      const clubRes = await client.query(
        `SELECT promo_settings FROM clubs WHERE id = $1`,
        [item.club_id]
      );
      const settings = clubRes.rows[0]?.promo_settings || {};

      let target = 0;
      if (item.loyalty_type === "packages") {
        target = parseInt(settings.packages_accumulation_target || "5");
        await client.query(
          `UPDATE promo_package_progress 
           SET current_count = GREATEST(0, current_count - $1),
               accumulated_packages = GREATEST(0, COALESCE(accumulated_packages, 0) - $1),
               updated_at = NOW()
           WHERE player_id = $2 AND club_id = $3 AND (program_id = 'legacy_packages' OR program_id = 'legacy')`,
          [target, item.player_id, item.club_id]
        );
      } else if (item.loyalty_type === "visits") {
        target = parseInt(settings.packages_visits_target || "10");
        await client.query(
          `UPDATE promo_package_progress 
           SET current_count = GREATEST(0, current_count - $1),
               accumulated_visits = GREATEST(0, COALESCE(accumulated_visits, 0) - $1),
               updated_at = NOW()
           WHERE player_id = $2 AND club_id = $3 AND (program_id = 'legacy_visits' OR program_id = 'legacy')`,
          [target, item.player_id, item.club_id]
        );
      } else if (item.loyalty_type === "streak") {
        await client.query(
          `UPDATE promo_package_progress 
           SET current_count = 0,
               current_streak = 0,
               updated_at = NOW()
           WHERE player_id = $1 AND club_id = $2 AND (program_id = 'legacy_streak' OR program_id = 'legacy')`,
          [item.player_id, item.club_id]
        );
      }

      // Credit digital rewards
      if (item.reward_type === "bonus_balance" && parseFloat(item.reward_value) > 0) {
        await client.query(
          `UPDATE promo_player_balances 
           SET bonus_balance = bonus_balance + $1, updated_at = NOW()
           WHERE player_id = $2 AND club_id = $3`,
          [parseFloat(item.reward_value), item.player_id, item.club_id]
        );
      } else if (item.reward_type === "ticket" && parseInt(item.reward_value) > 0) {
        await client.query(
          `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at, history_id)
           SELECT $1::uuid, $2::int, 'available', 'loyalty_reward', NULL, $3::uuid
           FROM generate_series(1, $4)`,
          [item.player_id, item.club_id, targetId, Math.floor(parseFloat(item.reward_value))]
        );
      } else if (item.reward_type === "xp" && parseInt(item.reward_value) > 0) {
        const { addPlayerXP } = await import("@/lib/promo-quests");
        await addPlayerXP(client, item.club_id, item.player_id, Math.floor(parseFloat(item.reward_value)));
      }
    }

    // 3b. If claimed and it is a bar item — deduct inventory
    if (action === "claim" && item.prize_type === "bar_item" && item.deduct_inventory && item.bar_product_id) {
      const qtyToDeduct = Math.max(1, Math.floor(parseFloat(item.reward_value || "1")));
      await client.query(
        `UPDATE products
         SET quantity = GREATEST(0, COALESCE(quantity, 0) - $2), updated_at = NOW()
         WHERE id = $1`,
        [item.bar_product_id, qtyToDeduct]
      );
    }

    // 4. If canceled and it is a withdrawal, refund player balance
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
