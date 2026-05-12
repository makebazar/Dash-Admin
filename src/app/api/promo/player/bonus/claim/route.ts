import { NextResponse } from "next/server";
import { query, getClient } from "@/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  let client;
  try {
    const { amount } = await request.json();
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json(
        { error: "Некорректная сумма" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubIdStr = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubIdStr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeClubId = parseInt(activeClubIdStr);

    if (isNaN(activeClubId)) {
      return NextResponse.json({ error: "Invalid Club ID" }, { status: 400 });
    }

    client = await getClient();
    await client.query("BEGIN");

    // 0. Get club owner (as the creator/assignee for the request)
    const clubResult = await client.query(
      `SELECT owner_id FROM clubs WHERE id = $1`,
      [activeClubId],
    );

    if (clubResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    const ownerId = clubResult.rows[0].owner_id;

    // 1. Get player balance and info
    const balanceResult = await client.query(
      `SELECT b.bonus_balance, p.full_name, p.phone_number
       FROM promo_player_balances b
       JOIN promo_players p ON p.id = b.player_id
       WHERE b.player_id = $1 AND b.club_id = $2`,
      [playerId, activeClubId],
    );

    if (balanceResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Balance not found" }, { status: 404 });
    }

    const { bonus_balance, full_name, phone_number } = balanceResult.rows[0];
    const currentBalance = parseFloat(bonus_balance);

    if (withdrawAmount > currentBalance) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Недостаточно бонусов на балансе" },
        { status: 400 },
      );
    }

    // 2. Deduct balance
    await client.query(
      `UPDATE promo_player_balances SET bonus_balance = bonus_balance - $3 WHERE player_id = $1 AND club_id = $2`,
      [playerId, activeClubId, withdrawAmount],
    );

    // 3. Create employee request
    const title = `Зачисление бонусов: ${withdrawAmount}`;
    const description = `Игрок ${full_name} (${phone_number}) просит зачислить ${withdrawAmount} бонусов на аккаунт клуба.`;

    const requestRes = await client.query(
      `INSERT INTO employee_requests (club_id, user_id, category, priority, title, description, is_read_by_employee)
       VALUES ($1, $2, 'FINANCIAL', 'HIGH', $3, $4, FALSE)
       RETURNING id`,
      [activeClubId, ownerId, title, description],
    );

    const requestId = requestRes.rows[0].id;

    // 3.1 Create initial message for the request
    await client.query(
      `INSERT INTO employee_request_messages (request_id, sender_id, message)
       VALUES ($1, $2, $3)`,
      [requestId, ownerId, description],
    );

    // 3.2 Add to promo_prize_queue for visibility in "Очередь выдачи"
    await client.query(
      `INSERT INTO promo_prize_queue (history_id, player_id, club_id, prize_id, status, withdraw_amount)
       VALUES ($1, $2, $3, NULL, 'pending', $4)`,
      [
        null, // history_id is technically required by FK, let's see if we can use the promo_history id later
        playerId,
        activeClubId,
        withdrawAmount,
      ],
    );

    // 4. Log in promo_history
    const historyRes = await client.query(
      `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
       VALUES ($1, $2, 'WITHDRAW', $3)
       RETURNING id`,
      [
        playerId,
        activeClubId,
        JSON.stringify({ amount: withdrawAmount, request_id: requestId }),
      ],
    );
    const historyId = historyRes.rows[0].id;

    // Update the queue entry with history_id (since it's a FK)
    await client.query(
      `UPDATE promo_prize_queue SET history_id = $1 WHERE history_id IS NULL AND player_id = $2 AND club_id = $3 AND withdraw_amount = $4 AND status = 'pending'`,
      [historyId, playerId, activeClubId, withdrawAmount],
    );

    await client.query("COMMIT");

    // 5. Notify admin/staff
    try {
      const { notifyInventoryClub } = await import("@/lib/inventory-events");
      notifyInventoryClub(String(activeClubId), {
        type: "PROMO_QUEUE_UPDATED",
        timestamp: Date.now(),
      });
    } catch (e) {
      console.error("[SSE] Failed to send promo notification:", e);
    }

    await query(`SELECT pg_notify('employee_requests_updates', $1)`, [
      activeClubId,
    ]);
    await query(`SELECT pg_notify('promo_queue_updates', $1)`, [activeClubId]);

    return NextResponse.json({
      success: true,
      message: "Запрос отправлен администратору",
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Claim Bonus Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
