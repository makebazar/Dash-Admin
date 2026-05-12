import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;

    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all clubs where the player has a balance
    const result = await query(
      `SELECT c.id, c.name, c.address, b.total_xp, b.bonus_balance,
              (SELECT COUNT(*) FROM promo_tickets t WHERE t.player_id = $1 AND t.club_id = c.id AND t.status = 'available' AND (t.expires_at IS NULL OR t.expires_at > NOW())) as tickets_count
             FROM promo_player_balances b
             JOIN clubs c ON c.id = b.club_id
             WHERE b.player_id = $1
             ORDER BY b.updated_at DESC`,
      [playerId],
    );

    return NextResponse.json({
      success: true,
      clubs: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        totalXp: parseFloat(row.total_xp),
        bonusBalance: parseFloat(row.bonus_balance),
        tickets: row.tickets_count,
      })),
    });
  } catch (error) {
    console.error("Promo Player Clubs Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// POST to switch active club
export async function POST(request: Request) {
  try {
    const { clubId } = await request.json();
    if (!clubId) {
      return NextResponse.json(
        { error: "Club ID is required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("promo_active_club_id", String(clubId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
