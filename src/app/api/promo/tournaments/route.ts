import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { calculateTournamentPoints } from "@/lib/promo-frag-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerIdStr = cookieStore.get("promo_player_id")?.value;
    const clubIdStr = cookieStore.get("promo_active_club_id")?.value;

    if (!playerIdStr || !clubIdStr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const playerId = parseInt(playerIdStr);
    const clubId = parseInt(clubIdStr);

    // 1. Fetch active and completed tournaments
    const tournamentsRes = await query(
      `SELECT id, club_id, title, game, start_date, end_date, min_matches, prizes, status, description
       FROM promo_tournaments
       WHERE club_id = $1
       ORDER BY start_date DESC`,
      [clubId]
    );

    const tournaments = tournamentsRes.rows;
    const enrichedTournaments = [];

    // 2. For each tournament, fetch matches and compute ranks
    for (const t of tournaments) {
      let gameFilter = "";
      const queryParams: any[] = [clubId, t.start_date, t.end_date];

      if (t.game !== "ALL") {
        gameFilter = "AND m.game = $4";
        queryParams.push(t.game);
      }

      const matchesRes = await query(
        `SELECT 
          m.player_id,
          p.full_name,
          m.game,
          m.kills,
          m.deaths,
          m.assists,
          m.headshots,
          m.last_hits,
          m.events,
          m.played_at
         FROM promo_frag_matches m
         JOIN promo_players p ON m.player_id = p.id
         WHERE m.club_id = $1 
           AND m.played_at BETWEEN $2 AND $3
           AND m.map !~* 'training|aim_|botz|reflex|practice|workshop|custom|tutorial|test|csstats|cybershoke|am_|awp_|duels_|arena|bhop|surf|retake|deathmatch|dm_|lobby|hs_'
           ${gameFilter}`,
        queryParams
      );

      const playerMatchesMap = new Map<number, any[]>();
      matchesRes.rows.forEach((m: any) => {
        if (!playerMatchesMap.has(m.player_id)) {
          playerMatchesMap.set(m.player_id, []);
        }
        playerMatchesMap.get(m.player_id)!.push(m);
      });

      const leaderboard: any[] = [];
      playerMatchesMap.forEach((pMatches, pId) => {
        const playerInfo = pMatches[0];
        const stats = calculateTournamentPoints(pMatches);
        const qualified = stats.matchesCount >= t.min_matches;

        leaderboard.push({
          player_id: pId,
          full_name: playerInfo.full_name,
          points: stats.points,
          wins: stats.wins,
          losses: stats.losses,
          matches_count: stats.matchesCount,
          qualified,
        });
      });

      // Sort by points descending
      leaderboard.sort((a, b) => b.points - a.points);

      // Map ranks (only qualified players receive prizes/rank positions, non-qualified are listed below)
      const rankedQualified = leaderboard.filter(p => p.qualified).map((p, i) => ({ ...p, rank: i + 1 }));
      const unranked = leaderboard.filter(p => !p.qualified).map(p => ({ ...p, rank: null }));
      const fullBoard = [...rankedQualified, ...unranked];

      // Find current player in the fullBoard
      const myStats = fullBoard.find(p => p.player_id === playerId) || null;

      // Extract top 10 for display
      const top10 = fullBoard.slice(0, 10);

      enrichedTournaments.push({
        id: t.id,
        title: t.title,
        game: t.game,
        start_date: t.start_date,
        end_date: t.end_date,
        min_matches: t.min_matches,
        prizes: typeof t.prizes === "string" ? JSON.parse(t.prizes) : t.prizes,
        status: t.status,
        description: t.description,
        myStats: myStats ? {
          rank: myStats.rank,
          points: myStats.points,
          matches_count: myStats.matches_count,
          wins: myStats.wins,
          losses: myStats.losses,
          qualified: myStats.qualified,
        } : {
          rank: null,
          points: 0,
          matches_count: 0,
          wins: 0,
          losses: 0,
          qualified: false,
        },
        leaderboard: top10,
        fullLeaderboardCount: fullBoard.length,
      });
    }

    return NextResponse.json({ tournaments: enrichedTournaments });
  } catch (error) {
    console.error("Player Tournaments API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
