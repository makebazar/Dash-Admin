import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import { calculateTournamentPoints } from "../leaderboard/route";

export const dynamic = "force-dynamic";

// POST /api/promo/admin/frag/tournaments/[id]/complete — End tournament and distribute rewards
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient();
  try {
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { clubId } = body;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId || !clubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch tournament details
    const tournamentRes = await client.query(
      `SELECT id, club_id, title, game, start_date, end_date, min_matches, prizes, status
       FROM promo_tournaments
       WHERE id = $1 AND club_id = $2`,
      [tournamentId, clubId]
    );

    if (tournamentRes.rowCount === 0) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const tournament = tournamentRes.rows[0];

    if (tournament.status === "completed") {
      return NextResponse.json({ error: "Tournament already completed" }, { status: 400 });
    }

    // 2. Fetch matches played during tournament dates to calculate final leaderboard
    let gameFilter = "";
    const queryParams: any[] = [clubId, tournament.start_date, tournament.end_date];

    if (tournament.game !== "ALL") {
      gameFilter = "AND m.game = $4";
      queryParams.push(tournament.game);
    }

    const matchesRes = await client.query(
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
         AND m.map NOT ILIKE '%training%'
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

    // 4. Calculate TP and filter qualified players
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
        qualified,
      });
    });

    // Sort by points descending, filtering only qualified players
    const qualifiedLeaderboard = leaderboard
      .filter(item => item.qualified)
      .sort((a, b) => b.points - a.points);

    // Parse prizes array
    const prizes = typeof tournament.prizes === "string" ? JSON.parse(tournament.prizes) : (tournament.prizes || []);

    // 5. Begin transaction to credit balances
    await client.query("BEGIN");

    const awardedPlayers: any[] = [];

    for (const prize of prizes) {
      const place = parseInt(prize.place);
      const reward = parseFloat(prize.reward) || 0;
      const textPrize = prize.text_prize || "";
      const prizeDesc = prize.description || "";

      if (isNaN(place)) continue;
      if (reward <= 0 && !textPrize) continue;

      // Find player for this place (place is 1-indexed, array is 0-indexed)
      const playerIndex = place - 1;
      if (playerIndex >= 0 && playerIndex < qualifiedLeaderboard.length) {
        const winner = qualifiedLeaderboard[playerIndex];

        // A. Credit balance if reward is positive
        if (reward > 0) {
          const balanceUpdateRes = await client.query(
            `UPDATE promo_player_balances
             SET bonus_balance = bonus_balance + $1, updated_at = NOW()
             WHERE player_id = $2 AND club_id = $3
             RETURNING player_id`,
            [reward, winner.player_id, clubId]
          );

          if (balanceUpdateRes.rowCount === 0) {
            // Create balance if it didn't exist
            await client.query(
              `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
               VALUES ($1, $2, $3)`,
              [winner.player_id, clubId, reward]
            );
          }
        }

        // B. Add history entry containing the balance amount and text details
        await client.query(
          `INSERT INTO promo_history (player_id, club_id, game_type, result_data)
           VALUES ($1, $2, 'TOURNAMENT', $3)`,
          [
            winner.player_id,
            clubId,
            JSON.stringify({
              action: "tournament_prize",
              amount: reward,
              text_prize: textPrize,
              description: prizeDesc,
              tournament_id: tournament.id,
              tournament_title: tournament.title,
              place: place,
              timestamp: new Date().toISOString(),
            }),
          ]
        );

        awardedPlayers.push({
          player_id: winner.player_id,
          full_name: winner.full_name,
          place,
          reward,
          text_prize: textPrize,
        });
      }
    }

    // 6. Update tournament status to completed
    await client.query(
      `UPDATE promo_tournaments
       SET status = 'completed'
       WHERE id = $1 AND club_id = $2`,
      [tournamentId, clubId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      awardedPlayers,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Complete Tournament Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
