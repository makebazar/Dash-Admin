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
       WHERE player_id = $1 AND club_id = $2 AND (game != 'CS2' OR map ~* '^(de_mirage|de_dust2|de_inferno|de_nuke|de_anubis|de_ancient|de_vertigo|de_overpass|de_train|de_cache|cs_office|cs_italy)$')
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
