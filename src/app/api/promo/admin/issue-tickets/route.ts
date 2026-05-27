import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { calculateTicketsForAmount } from "@/lib/promo-accrual";

export async function POST(request: Request) {
  try {
    const {
      phoneNumber,
      amount,
      clubId,
      mode = "amount",
      ticketCount,
    } = await request.json();
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!phoneNumber || !clubId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    const numericClubId = parseInt(String(clubId), 10);
    if (isNaN(numericClubId)) {
      return NextResponse.json(
        { error: "Некорректный ID клуба" },
        { status: 400 },
      );
    }

    // 1. Get club settings
    const clubResult = await query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [numericClubId],
    );

    const settings = clubResult.rows[0]?.promo_settings || {};

    let finalTicketsCount = 0;
    if (mode === "count") {
      finalTicketsCount = parseInt(ticketCount) || 0;
    } else {
      finalTicketsCount = calculateTicketsForAmount(
        parseFloat(amount) || 0,
        settings,
      );
    }

    if (finalTicketsCount <= 0) {
      return NextResponse.json({
        success: true,
        ticketsIssued: 0,
        message:
          mode === "count"
            ? "Количество должно быть больше 0"
            : `Сумма недостаточна для начисления билетов.`,
      });
    }

    // 2. Find or Create player (Identity)
    // Note: Admin might not know the PIN, so we just ensure identity exists
    // If it doesn't, we'll need the player to register later.
    let playerResult = await query(
      `SELECT id FROM promo_players WHERE phone_number = $1`,
      [phoneNumber],
    );

    let playerId;
    if (playerResult.rowCount === 0) {
      // Create "shadow" player without PIN (they will set it on first login)
      const newPlayer = await query(
        `INSERT INTO promo_players (phone_number, full_name, pin_hash)
                 VALUES ($1, 'Гость', 'PENDING') RETURNING id`,
        [phoneNumber],
      );
      playerId = newPlayer.rows[0].id;
    } else {
      playerId = playerResult.rows[0].id;
    }

    // 3. Ensure balance record exists
    await query(
      `INSERT INTO promo_player_balances (player_id, club_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [playerId, numericClubId],
    );

    // 4. Issue tickets
    await query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
             SELECT $1, $2, 'available', 'admin_manual', NULL
             FROM generate_series(1, $3)`,
      [playerId, numericClubId, finalTicketsCount],
    );

    // 5. Process Quests (if amount was used)
    if (mode === "amount" && parseFloat(amount) > 0) {
      try {
        const { getClient } = await import("@/db");
        const { processBalanceTopupEvent } = await import("@/lib/promo-quests");
        const client = await getClient();
        try {
          await processBalanceTopupEvent(
            client,
            numericClubId,
            playerId,
            parseFloat(amount),
          );
        } finally {
          client.release();
        }
      } catch (e) {
        console.error("Quest Balance Topup Processing Error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      ticketsIssued: finalTicketsCount,
      expiresAt: null,
    });
  } catch (error) {
    console.error("Issue Tickets Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId || !playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mark all available tickets as 'expired' or just delete them?
    // Let's mark as 'expired' to keep history, or just delete if they were manual mistakes.
    // Given the user wants to "edit" the count, we can just delete available ones and let them add new ones.
    await query(
      `DELETE FROM promo_tickets
       WHERE player_id = $1 AND club_id = $2 AND status = 'available'`,
      [playerId, clubId],
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset Tickets Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
