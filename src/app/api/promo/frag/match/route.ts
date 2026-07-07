import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

// POST /api/promo/frag/match — Save a completed frag match from the local agent
export async function POST(request: Request) {
  const client = await getClient();
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      game = "CS2",
      map = "Unknown",
      score = "0:0",
      kills = 0,
      deaths = 0,
      assists = 0,
      headshots = 0,
      lastHits = 0,
      earnedBonuses = 0,
      events = [],
    } = body;

    await client.query(
      `INSERT INTO promo_frag_matches
         (player_id, club_id, game, map, score, kills, deaths, assists, headshots, last_hits, earned, events)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        playerId,
        activeClubId,
        game,
        map,
        score,
        kills,
        deaths,
        assists,
        headshots,
        lastHits,
        earnedBonuses,
        JSON.stringify(events),
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Frag Match Save Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
