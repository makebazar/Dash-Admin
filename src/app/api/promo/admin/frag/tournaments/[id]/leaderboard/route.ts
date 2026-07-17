import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { calculateTournamentPoints } from "@/lib/promo-frag-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch tournament details
    const tournamentRes = await query(
      `SELECT id, club_id, title, game, start_date, end_date, min_matches, prizes, status
       FROM promo_tournaments
       WHERE id = $1 AND club_id = $2`,
      [tournamentId, clubId]
    );

    if (tournamentRes.rowCount === 0) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const tournament = tournamentRes.rows[0];

    // 2. Fetch matches played during tournament dates
    let gameFilter = "";
    const queryParams: any[] = [clubId, tournament.start_date, tournament.end_date];

    if (tournament.game !== "ALL") {
      gameFilter = "AND m.game = $4";
      queryParams.push(tournament.game);
    }

    const matchesRes = await query(
      `SELECT 
        m.player_id,
        p.full_name,
        p.phone_number,
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

    // 3. Aggregate matches by player
    const playerMatchesMap = new Map<number, any[]>();
    matchesRes.rows.forEach((m: any) => {
      if (!playerMatchesMap.has(m.player_id)) {
        playerMatchesMap.set(m.player_id, []);
      }
      playerMatchesMap.get(m.player_id)!.push(m);
    });

    // 4. Calculate TP and details for each player
    const leaderboard: any[] = [];
    playerMatchesMap.forEach((pMatches, playerId) => {
      const playerInfo = pMatches[0];
      const stats = calculateTournamentPoints(pMatches);
      const qualified = stats.matchesCount >= tournament.min_matches;

      leaderboard.push({
        player_id: playerId,
        full_name: playerInfo.full_name,
        phone_number: playerInfo.phone_number,
        points: stats.points,
        wins: stats.wins,
        losses: stats.losses,
        matches_count: stats.matchesCount,
        total_kills: stats.totalKills,
        total_deaths: stats.totalDeaths,
        total_assists: stats.totalAssists,
        qualified,
      });
    });

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Append ranks
    const rankedLeaderboard = leaderboard.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return NextResponse.json({
      tournament,
      leaderboard: rankedLeaderboard,
    });
  } catch (error) {
    console.error("Fetch Tournament Leaderboard Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
