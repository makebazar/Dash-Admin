import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { calculateCs2MatchElo, EloPlayerInput } from "@/lib/elo";
import { advancePlayoffWinner, resolveMatchFormat } from "@/lib/brackets";
import { broadcastSseCommand } from "@/lib/cs2/sse";

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
    const numericMatchId = parseInt(matchId, 10) || 0;

    console.log(`[CS2 Webhook] Club ${parsedClubId} received event: ${event} for match ${matchId}`);

    const rawTourneyId = numericMatchId > 0 ? numericMatchId : parseInt(matchId.replace("dm-tourney-", "").replace("dm-", ""), 10);
    const tourneyMatchId = !isNaN(rawTourneyId) && rawTourneyId > 0 ? rawTourneyId : null;

    // Update club_cs2_matches live state
    if (matchId) {
      if (event === "series_start") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'warmup', game_state = 'warmup', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "knife_start") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'knife', game_state = 'knife', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "side_picked" || event === "knife_won") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'knife_won', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "going_live") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'live', game_state = 'live', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "round_end") {
        const team1Score = payload.team1?.score ?? payload.team1_score ?? 0;
        const team2Score = payload.team2?.score ?? payload.team2_score ?? 0;
        const matchStats = { team1: payload.team1, team2: payload.team2 };
        await client.query(
          `UPDATE club_cs2_matches SET score1 = $1, score2 = $2, match_stats = $3, status = 'live', game_state = 'live', updated_at = NOW() WHERE (id = $4 OR matchzy_id = $5) AND club_id = $6`,
          [team1Score, team2Score, JSON.stringify(matchStats), matchId, numericMatchId, parsedClubId]
        ).catch(() => {});

        if (tourneyMatchId) {
          await client.query(
            `UPDATE tournament_matches SET score1 = $1, score2 = $2, result = jsonb_set(COALESCE(result, '{}'::jsonb), '{stats}', $3::jsonb) WHERE id = $4`,
            [team1Score, team2Score, JSON.stringify(matchStats), tourneyMatchId]
          ).catch(() => {});
        }
      } else if (event === "game_paused") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'paused', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "game_unpaused") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'live', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "backup_loaded") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'paused', updated_at = NOW() WHERE (id = $1 OR matchzy_id = $2) AND club_id = $3`,
          [matchId, numericMatchId, parsedClubId]
        ).catch(() => {});
      } else if (event === "map_result" || event === "series_end") {
        const team1Score = payload.team1_series_score ?? payload.team1?.score ?? payload.team1_score ?? 0;
        const team2Score = payload.team2_series_score ?? payload.team2?.score ?? payload.team2_score ?? 0;
        const isFinished = event === "series_end" || (payload.team1_series_score !== undefined);
        const status = isFinished ? "finished" : "live";
        const gameState = isFinished ? "finished" : "map_ended";
        const matchStats = { team1: payload.team1, team2: payload.team2 };
        await client.query(
          `UPDATE club_cs2_matches SET score1 = $1, score2 = $2, match_stats = $3, status = $4, game_state = $5, updated_at = NOW() WHERE (id = $6 OR matchzy_id = $7) AND club_id = $8`,
          [team1Score, team2Score, JSON.stringify(matchStats), status, gameState, matchId, numericMatchId, parsedClubId]
        ).catch(() => {});

        if (event === "series_end") {
          // Resolve the true string ID for DashMatch agent
          let agentMatchId = matchId;
          if (numericMatchId > 0 && !matchId.startsWith("dm-")) {
            const idRes = await client.query(
              `SELECT id FROM club_cs2_matches WHERE matchzy_id = $1 AND club_id = $2`,
              [String(numericMatchId), parsedClubId]
            ).catch(() => ({ rows: [] }));
            if (idRes.rows && idRes.rows.length > 0) {
              agentMatchId = idRes.rows[0].id;
            }
          }

          // Enqueue STOP_MATCH command and notify agent via SSE to close cs2.exe
          await client.query(
            `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
             VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
            [parsedClubId, agentMatchId]
          ).catch(() => {});

          broadcastSseCommand(parsedClubId, {
            type: "STOP_MATCH",
            match_id: agentMatchId,
          });
        }
      }

      // Notify tournament match lobby & bracket in real time
      if (tourneyMatchId) {
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(tourneyMatchId)]).catch(() => {});
        const tRes = await client.query(`SELECT tournament_id FROM tournament_matches WHERE id = $1`, [tourneyMatchId]).catch(() => ({ rows: [] }));
        if (tRes.rows && tRes.rows.length > 0) {
          await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tRes.rows[0].tournament_id)]).catch(() => {});
        }
      }
    }

    // If map ended, calculate results and ELO
    if (event === "map_result" && matchId) {
      await client.query("BEGIN");

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id, m.status,
                t.config as tournament_config
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

        // Determine if series is completed
        const resolvedFormat = resolveMatchFormat(match.tournament_config, match.round, undefined, match.result);
        const numMaps = resolvedFormat === "bo5" ? 5 : (resolvedFormat === "bo3" ? 3 : 1);
        const mapsToWin = Math.ceil(numMaps / 2);
        const team1SeriesScore = payload.team1?.series_score ?? (team1Won ? 1 : 0);
        const team2SeriesScore = payload.team2?.series_score ?? (!team1Won ? 1 : 0);
        const isSeriesOver = numMaps <= 1 || team1SeriesScore >= mapsToWin || team2SeriesScore >= mapsToWin;

        const seriesWinnerCompetitorId = team1SeriesScore > team2SeriesScore ? match.competitor_a_id : match.competitor_b_id;
        const displayScore1 = numMaps > 1 ? team1SeriesScore : team1Score;
        const displayScore2 = numMaps > 1 ? team2SeriesScore : team2Score;

        if (isSeriesOver) {
          // Finalize match row
          await client.query(
            `UPDATE tournament_matches
             SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3, result = $4
             WHERE id = $5`,
            [displayScore1, displayScore2, seriesWinnerCompetitorId, JSON.stringify(payload), matchId]
          );

          // Advance bracket if in playoffs
          if (match.round > 0 && seriesWinnerCompetitorId) {
            await advancePlayoffWinner(client, matchId, seriesWinnerCompetitorId);
          }
        } else {
          // Series continues: update current map/series score without finishing match prematurely
          await client.query(
            `UPDATE tournament_matches
             SET score1 = $1, score2 = $2, result = $3
             WHERE id = $4`,
            [displayScore1, displayScore2, JSON.stringify(payload), matchId]
          );
        }

        await client.query("COMMIT");

        // Notify tournament bracket and lobby
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
      } else {
        await client.query("COMMIT");
      }
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
