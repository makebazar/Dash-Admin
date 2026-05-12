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

    // 1. Get club settings
    const clubResult = await query(
      `SELECT promo_settings FROM clubs WHERE id = $1`,
      [clubId],
    );

    const settings = clubResult.rows[0]?.promo_settings || {};
    const expiryHours = settings.ticket_expiry_hours || 24;

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
      [playerId, clubId],
    );

    // 4. Issue tickets
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + expiryHours);

    await query(
      `INSERT INTO promo_tickets (player_id, club_id, status, source, expires_at)
             SELECT $1, $2, 'available', 'admin_manual', $3
             FROM generate_series(1, $4)`,
      [playerId, clubId, expiryDate, finalTicketsCount],
    );

    return NextResponse.json({
      success: true,
      ticketsIssued: finalTicketsCount,
      expiresAt: expiryDate,
    });
  } catch (error) {
    console.error("Issue Tickets Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
