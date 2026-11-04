import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function sanitizeCookieValue(val?: string): string | null {
  if (!val) return null;
  let clean = decodeURIComponent(val).trim().replace(/^s:/, "").replace(/^"|"$/g, "");
  if (clean.includes(".")) {
    clean = clean.split(".")[0];
  }
  return clean || null;
}

// GET /api/promo/frag/leaderboard — Overall all-time FRAG leaderboard for the club
export async function GET(request: Request) {
  let client;
  try {
    const cookieStore = await cookies();
    const rawPlayerId = cookieStore.get("promo_player_id")?.value;
    const rawActiveClubId = cookieStore.get("promo_active_club_id")?.value;

    const playerId = sanitizeCookieValue(rawPlayerId);
    const activeClubId = sanitizeCookieValue(rawActiveClubId);

    if (!activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const game = searchParams.get("game") || "ALL"; // ALL | CS2 | Dota2 | PUBG
    const sortBy = searchParams.get("sort") || "earned"; // earned | kills | matches

    client = await getClient();

    const queryParams: any[] = [activeClubId];
    let gameFilter = "";

    if (game && game !== "ALL") {
      queryParams.push(game);
      const paramIdx = queryParams.length;
      gameFilter = `AND (CASE WHEN m.game = 'Dota 2' THEN 'Dota2' ELSE m.game END) = $${paramIdx}`;
    }

    const orderClause =
      sortBy === "kills"
        ? "ORDER BY total_kills DESC, total_earned DESC"
        : sortBy === "matches"
        ? "ORDER BY matches_count DESC, total_earned DESC"
        : "ORDER BY total_earned DESC, total_kills DESC";

    const queryStr = `
      SELECT 
        p.id as player_id,
        p.full_name,
        p.nickname,
        p.avatar_url,
        COUNT(m.id)::int as matches_count,
        COALESCE(SUM(m.kills), 0)::int as total_kills,
        COALESCE(SUM(m.deaths), 0)::int as total_deaths,
        COALESCE(SUM(m.assists), 0)::int as total_assists,
        COALESCE(SUM(m.headshots), 0)::int as total_headshots,
        COALESCE(SUM(m.earned), 0)::float as total_earned,
        MAX(m.played_at) as last_played_at
      FROM promo_frag_matches m
      JOIN promo_players p ON m.player_id = p.id
      WHERE m.club_id = $1 
        AND (m.game != 'CS2' OR m.map ~* '^(de_mirage|de_dust2|de_inferno|de_nuke|de_anubis|de_ancient|de_vertigo|de_overpass|de_train|de_cache|cs_office|cs_italy)$')
        ${gameFilter}
      GROUP BY p.id, p.full_name, p.nickname, p.avatar_url
      ${orderClause}
      LIMIT 100
    `;

    const result = await client.query(queryStr, queryParams);

    const leaders = result.rows.map((row: any, idx: number) => {
      const deaths = row.total_deaths || 0;
      const kills = row.total_kills || 0;
      const kd = deaths > 0 ? (kills / deaths).toFixed(2) : String(kills);
      return {
        rank: idx + 1,
        player_id: row.player_id,
        full_name: row.full_name,
        nickname: row.nickname,
        avatar_url: row.avatar_url,
        matches_count: row.matches_count,
        total_kills: row.total_kills,
        total_deaths: row.total_deaths,
        total_assists: row.total_assists,
        total_headshots: row.total_headshots,
        total_earned: Math.round(row.total_earned * 10) / 10,
        kd,
        last_played_at: row.last_played_at,
      };
    });

    const myStats = playerId ? leaders.find((l: any) => l.player_id === playerId) || null : null;

    return NextResponse.json({
      leaders,
      totalCount: leaders.length,
      myStats,
    });
  } catch (error) {
    console.error("FRAG General Leaderboard Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}
