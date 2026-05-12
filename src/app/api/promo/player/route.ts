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

    // Get player global data + club-specific balance
    const result = await query(
      `SELECT p.id, p.full_name, p.phone_number, b.total_xp, b.bonus_balance, c.name as club_name, c.promo_settings
             FROM promo_players p
             JOIN promo_player_balances b ON p.id = b.player_id AND b.club_id = $2
             JOIN clubs c ON c.id = b.club_id
             WHERE p.id = $1`,
      [playerId, activeClubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 });
    }

    const data = result.rows[0];

    // Get tickets for THIS club
    const ticketsResult = await query(
      `SELECT COUNT(*)::int as count
             FROM promo_tickets
             WHERE player_id = $1 AND club_id = $2 AND status = 'available' AND (expires_at IS NULL OR expires_at > NOW())`,
      [playerId, activeClubId],
    );

    return NextResponse.json({
      player: {
        id: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        totalXp: parseFloat(data.total_xp),
        bonusBalance: parseFloat(data.bonus_balance),
        clubName: data.club_name,
        clubId: activeClubId,
        settings: data.promo_settings,
      },
      tickets: ticketsResult.rows[0].count,
    });
  } catch (error) {
    console.error("Promo Player Info Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
