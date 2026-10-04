import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { calculateCs2MatchElo, EloPlayerInput } from "@/lib/elo";
import { advancePlayoffWinner } from "@/lib/brackets";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId } = await params;
    const parsedClubId = parseInt(clubId);

    const payload = await request.json();
    const event = payload.event;
    const matchId = String(payload.matchid || "");

    console.log(`[CS2 Webhook] Club ${parsedClubId} received event: ${event} for match ${matchId}`);

    // If map ended, calculate results and ELO
    if (event === "map_result" && matchId) {
      await client.query("BEGIN");

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id, m.status
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1 AND t.club_id = $2`,
        [matchId, parsedClubId]
      );

      if (matchRes.rowCount > 0 && matchRes.rows[0].status !== "FINISHED") {
        const match = matchRes.rows[0];
        const team1Score = payload.team1?.score ?? 0;
        const team2Score = payload.team2?.score ?? 0;
        const totalRounds = Math.max(1, team1Score + team2Score);

        const team1Won = team1Score > team2Score;
        const winnerCompetitorId = team1Won ? match.competitor_a_id : match.competitor_b_id;

        // Process players for ELO calculation
        const mapToEloInputs = async (players: any[]): Promise<EloPlayerInput[]> => {
          const list: EloPlayerInput[] = [];
          for (const p of players || []) {
            const steamId = String(p.steamid || "");
            const playerRes = await client.query(
              `SELECT id FROM promo_players WHERE steam_id = $1`,
              [steamId]
            );

            if (playerRes.rows.length > 0) {
              const playerId = playerRes.rows[0].id;
              const eloRes = await client.query(
                `SELECT elo, matches_played FROM discipline_elo WHERE player_id = $1 AND discipline = 'cs2'`,
                [playerId]
              );

              const currentElo = eloRes.rows[0]?.elo ?? 1000;
              const matchesPlayed = eloRes.rows[0]?.matches_played ?? 0;
              const damage = p.stats?.damage ?? 0;
              const adr = damage / totalRounds;

              list.push({
                playerId,
                elo: currentElo,
                matchesPlayed,
                adr,
              });
            }
          }
          return list;
        };

        const team1EloInputs = await mapToEloInputs(payload.team1?.players);
        const team2EloInputs = await mapToEloInputs(payload.team2?.players);

        if (team1EloInputs.length > 0 && team2EloInputs.length > 0) {
          const eloResults = calculateCs2MatchElo(team1EloInputs, team2EloInputs, team1Won);

          // Update ELO for all participants
          for (const res of eloResults) {
            await client.query(
              `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated, updated_at)
               VALUES ($1, 'cs2', $2, 1, $3, NOW())
               ON CONFLICT (player_id, discipline)
               DO UPDATE SET elo = $2, matches_played = discipline_elo.matches_played + 1, is_calibrated = $3, updated_at = NOW()`,
              [res.playerId, res.newElo, res.isCalibrated]
            );
          }
        }

        // Finalize match row
        await client.query(
          `UPDATE tournament_matches
           SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3, result = $4
           WHERE id = $5`,
          [team1Score, team2Score, winnerCompetitorId, JSON.stringify(payload), matchId]
        );

        // Advance bracket if in playoffs
        if (match.round > 0 && winnerCompetitorId) {
          await advancePlayoffWinner(client, matchId, winnerCompetitorId);
        }
      }

      await client.query("COMMIT");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("CS2 Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
