import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

    // Ignore training/practice matches
    if (map && typeof map === "string") {
      const lowerMap = map.toLowerCase();
      const isTraining = ["training", "aim_", "botz", "reflex", "practice", "workshop", "custom", "tutorial", "test", "csstats"].some(kw => lowerMap.includes(kw));
      if (isTraining) {
        return NextResponse.json({ success: true, ignored: true, message: "Training/practice matches are ignored" });
      }
    }

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

    // Ensure player has a balance record for this club
    await client.query(
      `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT DO NOTHING`,
      [playerId, activeClubId]
    );

    // Credit match earnings to player's balance
    if (earnedBonuses > 0) {
      await client.query(
        `UPDATE promo_player_balances
         SET bonus_balance = COALESCE(bonus_balance, 0) + $1
         WHERE player_id = $2 AND club_id = $3`,
        [earnedBonuses, playerId, activeClubId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Frag Match Save Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
