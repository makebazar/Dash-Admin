import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function sanitizeCookieValue(val?: string): string | null {
  if (!val) return null;
  let clean = decodeURIComponent(val).trim().replace(/^s:/, '').replace(/^"|"$/g, '');
  if (clean.includes('.')) {
    clean = clean.split('.')[0];
  }
  return clean || null;
}

// GET /api/promo/frag/history — Get frag match history for current player
export async function GET() {
  let client;
  try {
    const cookieStore = await cookies();
    const rawPlayerId = cookieStore.get("promo_player_id")?.value;
    const rawActiveClubId = cookieStore.get("promo_active_club_id")?.value;

    const playerId = sanitizeCookieValue(rawPlayerId);
    const activeClubId = sanitizeCookieValue(rawActiveClubId);

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    client = await getClient();

    const result = await client.query(
      `SELECT id, game, map, score, kills, deaths, assists, headshots, last_hits, earned, events, played_at
       FROM promo_frag_matches
       WHERE player_id = $1 AND club_id = $2 AND map !~* 'training|aim_|botz|reflex|practice|workshop|custom|tutorial|test|csstats|cybershoke|am_|awp_|duels_|arena|bhop|surf|retake|deathmatch|dm_|lobby|hs_'
       ORDER BY played_at DESC
       LIMIT 30`,
      [playerId, activeClubId]
    );

    return NextResponse.json({ matches: result.rows });
  } catch (error) {
    console.error("Frag History Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
