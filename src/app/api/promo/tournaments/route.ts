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

    const playerId = playerIdStr;
    const clubId = parseInt(clubIdStr);

    // 1. Fetch active and completed tournaments
    const tournamentsRes = await query(
      `SELECT id, club_id, title, game, start_date, end_date, min_matches, prizes, status, description, description as rules
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
          m.id,
          m.player_id,
          p.full_name,
          p.nickname,
          p.avatar_url,
          m.game,
          m.map,
          m.score,
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
           AND (m.game != 'CS2' OR m.map ~* '^(de_mirage|de_dust2|de_inferno|de_nuke|de_anubis|de_ancient|de_vertigo|de_overpass|de_train|de_cache|cs_office|cs_italy)$')
           ${gameFilter}
         ORDER BY m.played_at ASC`,
        queryParams
      );

      const allTournamentMatches = matchesRes.rows;

      const playerMatchesMap = new Map<any, any[]>();
      allTournamentMatches.forEach((m: any) => {
        const key = String(m.player_id);
        if (!playerMatchesMap.has(key)) {
          playerMatchesMap.set(key, []);
        }
        playerMatchesMap.get(key)!.push(m);
      });

      // Compute baseline rank (24 hours ago, or before the latest match) to show rank delta (▲ / ▼)
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const matchesOlderThan24h = allTournamentMatches.filter(
        (m: any) => new Date(m.played_at).getTime() < cutoff24h
      );

      let baselineMatches = matchesOlderThan24h;
      if (baselineMatches.length === 0 && allTournamentMatches.length > 1) {
        baselineMatches = allTournamentMatches.slice(0, allTournamentMatches.length - 1);
      }

      const prevRankMap = new Map<string, number>();
      if (baselineMatches.length > 0) {
        const prevPlayerMatchesMap = new Map<string, any[]>();
        baselineMatches.forEach((m: any) => {
          const key = String(m.player_id);
          if (!prevPlayerMatchesMap.has(key)) {
            prevPlayerMatchesMap.set(key, []);
          }
          prevPlayerMatchesMap.get(key)!.push(m);
        });

        const prevLeaderboard: any[] = [];
        prevPlayerMatchesMap.forEach((pMatches, pId) => {
          const stats = calculateTournamentPoints(pMatches);
          const qualified = stats.matchesCount >= t.min_matches;
          if (qualified) {
            prevLeaderboard.push({ player_id: pId, points: stats.points });
          }
        });
        prevLeaderboard.sort((a, b) => b.points - a.points);
        prevLeaderboard.forEach((item, idx) => {
          prevRankMap.set(String(item.player_id), idx + 1);
        });
      }

      const leaderboard: any[] = [];
      playerMatchesMap.forEach((pMatches, pId) => {
        const playerInfo = pMatches[0];
        const stats = calculateTournamentPoints(pMatches);
        const qualified = stats.matchesCount >= t.min_matches;

        leaderboard.push({
          player_id: pId,
          full_name: playerInfo.full_name,
          nickname: playerInfo.nickname,
          avatar_url: playerInfo.avatar_url,
          points: stats.points,
          wins: stats.wins,
          losses: stats.losses,
          matches_count: stats.matchesCount,
          qualified,
        });
      });

      // Sort by points descending
      leaderboard.sort((a, b) => b.points - a.points);

      // Map ranks and rank changes
      const rankedQualified = leaderboard
        .filter((p) => p.qualified)
        .map((p, i) => {
          const rank = i + 1;
          const prevRank = prevRankMap.get(String(p.player_id));
          const rankChange = prevRank !== undefined ? prevRank - rank : null;
          return {
            ...p,
            rank,
            prev_rank: prevRank ?? null,
            rank_change: rankChange,
          };
        });

      const unranked = leaderboard
        .filter((p) => !p.qualified)
        .map((p) => ({
          ...p,
          rank: null,
          prev_rank: null,
          rank_change: null,
        }));

      const fullBoard = [...rankedQualified, ...unranked];

      // Current player details & tournament matches breakdown
      const myMatchesRaw = playerMatchesMap.get(String(playerId)) || [];
      const myTournamentStats = calculateTournamentPoints(myMatchesRaw, 15);

      const myTournamentMatches = (myTournamentStats.allMatches || [])
        .map((item: any) => ({
          id: item.match.id,
          game: item.match.game,
          map: item.match.map,
          score: item.match.score,
          kills: item.match.kills || 0,
          deaths: item.match.deaths || 0,
          assists: item.match.assists || 0,
          headshots: item.match.headshots || 0,
          last_hits: item.match.last_hits || 0,
          played_at: item.match.played_at,
          events: item.match.events,
          points: item.points,
          isCounted: item.isCounted,
          isWin: item.isWin,
          breakdown: item.breakdown,
        }))
        .sort(
          (a: any, b: any) =>
            new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
        );

      const myStats =
        fullBoard.find((p) => String(p.player_id) === String(playerId)) || null;

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
        myStats: myStats
          ? {
              rank: myStats.rank,
              prev_rank: myStats.prev_rank,
              rank_change: myStats.rank_change,
              points: myStats.points,
              matches_count: myStats.matches_count,
              wins: myStats.wins,
              losses: myStats.losses,
              qualified: myStats.qualified,
            }
          : {
              rank: null,
              prev_rank: null,
              rank_change: null,
              points: 0,
              matches_count: 0,
              wins: 0,
              losses: 0,
              qualified: false,
            },
        myMatches: myTournamentMatches,
        leaderboard: fullBoard, // All participants who played!
        fullLeaderboardCount: fullBoard.length,
      });
    }

    return NextResponse.json({ tournaments: enrichedTournaments });
  } catch (error) {
    console.error("Player Tournaments API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
