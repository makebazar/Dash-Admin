import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { notifyInventoryClub } from "@/lib/inventory-events";

export async function POST(request: Request) {
  try {
    const { clubId, intent, cart } = await request.json();
    const playerId = (await cookies()).get("promo_player_id")?.value;

    if (!playerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!clubId) {
      return NextResponse.json({ error: "Missing clubId" }, { status: 400 });
    }

    // 1. Resolve clubId to internal numeric ID if it's a public_id or string ID
    const clubResult = await query(
      `SELECT id FROM clubs WHERE id::text = $1 OR UPPER(public_id) = UPPER($1)`,
      [String(clubId)],
    );

    if (clubResult.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const internalClubId = clubResult.rows[0].id;

    // 2. Get player info + BP status
    const playerResult = await query(
      `SELECT
        p.id, p.phone_number, p.full_name,
        COALESCE((
          SELECT has_premium
          FROM promo_bp_player_progress bp
          JOIN promo_bp_seasons s ON s.id = bp.season_id
          WHERE bp.player_id = p.id AND s.club_id = $2 AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date
        ), FALSE) as has_premium
       FROM promo_players p WHERE p.id = $1`,
      [playerId, internalClubId],
    );

    if (playerResult.rowCount === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const player = playerResult.rows[0];

    // 3. Notify cashiers via SSE (always use numeric ID for the room)
    notifyInventoryClub(String(internalClubId), {
      type: "PLAYER_CHECKIN",
      player: {
        id: player.id,
        phone_number: player.phone_number,
        full_name: player.full_name,
        has_premium: player.has_premium,
        intent,
        cart: intent === "bonus_order" ? cart : undefined,
      },
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo Checkin Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
