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
    const parsedClubId = parseInt(clubId, 10);

    const payload = await request.json();
    const event = payload.event;
    const rawMatchId = String(payload.matchid || "");
    const numericMatchId = parseInt(rawMatchId, 10) || 0;

    console.log(`[CS2 Webhook] Club ${parsedClubId} received event: ${event} for match ${rawMatchId}`);

    // 1. Resolve true CS2 match and tournament match from DB
    const cs2FindRes = await client.query(
      `SELECT id, club_id, config_data, matchzy_id 
       FROM club_cs2_matches 
       WHERE id = $1 OR matchzy_id = $2 OR (config_data->>'tournament_match_id') = $1
       LIMIT 1`,
      [rawMatchId, numericMatchId]
    ).catch(() => ({ rows: [] }));

    const cs2Row = cs2FindRes.rows[0];
    const resolvedCs2Id = cs2Row?.id || rawMatchId;
    const resolvedClubId = cs2Row?.club_id || parsedClubId;

    let tourneyMatchId: number | null = null;
    if (cs2Row?.config_data?.tournament_match_id) {
      tourneyMatchId = parseInt(cs2Row.config_data.tournament_match_id, 10) || null;
    }
    if (!tourneyMatchId) {
      const parsedNum = numericMatchId > 0 ? numericMatchId : parseInt(rawMatchId.replace("dm-tourney-", "").replace("dm-", ""), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        tourneyMatchId = parsedNum;
      }
    }

    const team1Score = payload.team1_series_score ?? payload.team1?.score ?? payload.team1_score ?? 0;
    const team2Score = payload.team2_series_score ?? payload.team2?.score ?? payload.team2_score ?? 0;
    const matchStats = {
      team1: payload.team1,
      team2: payload.team2,
      map_number: payload.map_number,
      round_number: payload.round_number,
      winner: payload.winner,
    };

    // Update club_cs2_matches live state
    if (resolvedCs2Id) {
      if (event === "series_start") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'warmup', game_state = 'warmup', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "knife_start") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'knife', game_state = 'knife', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "side_picked" || event === "knife_won") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'knife_won', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "going_live") {
        await client.query(
          `UPDATE club_cs2_matches SET status = 'live', game_state = 'live', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "round_end") {
        await client.query(
          `UPDATE club_cs2_matches SET score1 = $1, score2 = $2, match_stats = $3, status = 'live', game_state = 'live', updated_at = NOW() WHERE id = $4 AND club_id = $5`,
          [team1Score, team2Score, JSON.stringify(matchStats), resolvedCs2Id, resolvedClubId]
        ).catch(() => {});

        if (tourneyMatchId) {
          await client.query(
            `UPDATE tournament_matches SET score1 = $1, score2 = $2, result = jsonb_set(COALESCE(result, '{}'::jsonb), '{stats}', $3::jsonb) WHERE id = $4`,
            [team1Score, team2Score, JSON.stringify(matchStats), tourneyMatchId]
          ).catch(() => {});
        }
      } else if (event === "game_paused") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'paused', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "game_unpaused") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'live', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "backup_loaded") {
        await client.query(
          `UPDATE club_cs2_matches SET game_state = 'paused', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
          [resolvedCs2Id, resolvedClubId]
        ).catch(() => {});
      } else if (event === "map_result" || event === "series_end") {
        const isFinished = event === "series_end" || (payload.team1_series_score !== undefined);
        const status = isFinished ? "finished" : "live";
        const gameState = isFinished ? "finished" : "map_ended";
        await client.query(
          `UPDATE club_cs2_matches SET score1 = $1, score2 = $2, match_stats = $3, status = $4, game_state = $5, updated_at = NOW() WHERE id = $6 AND club_id = $7`,
          [team1Score, team2Score, JSON.stringify(matchStats), status, gameState, resolvedCs2Id, resolvedClubId]
        ).catch(() => {});

        if (event === "series_end") {
          // Enqueue STOP_MATCH command and notify agent via SSE to close cs2.exe
          await client.query(
            `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
             VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
            [resolvedClubId, resolvedCs2Id]
          ).catch(() => {});

          broadcastSseCommand(resolvedClubId, {
            type: "STOP_MATCH",
            match_id: resolvedCs2Id,
          });
        }
      }

      // Notify tournament match lobby & bracket in real time via SSE/PostgreSQL NOTIFY
      if (tourneyMatchId) {
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(tourneyMatchId)]).catch(() => {});
        const tRes = await client.query(`SELECT tournament_id FROM tournament_matches WHERE id = $1`, [tourneyMatchId]).catch(() => ({ rows: [] }));
        if (tRes.rows && tRes.rows.length > 0) {
          await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tRes.rows[0].tournament_id)]).catch(() => {});
        }
      }
    }

    // If map ended, calculate results and ELO
    if (event === "map_result" && tourneyMatchId) {
      await client.query("BEGIN");

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id, m.status,
                t.config as tournament_config
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1 AND t.club_id = $2`,
        [tourneyMatchId, resolvedClubId]
      );

      if (matchRes.rowCount > 0 && matchRes.rows[0].status !== "FINISHED") {
        const match = matchRes.rows[0];
        const team1Won = team1Score > team2Score;
        const totalRounds = Math.max(1, team1Score + team2Score);

        // Process players for ELO calculation
        const mapToEloInputs = async (playersObj: any): Promise<EloPlayerInput[]> => {
          const list: EloPlayerInput[] = [];
          const players = Array.isArray(playersObj) ? playersObj : (typeof playersObj === "object" && playersObj ? Object.values(playersObj) : []);
          for (const p of players as any[]) {
            const steamId = String(p.steamid || p.steamId || p.steam_id || "");
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
              const damage = p.damage ?? p.stats?.damage ?? 0;
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
            [displayScore1, displayScore2, seriesWinnerCompetitorId, JSON.stringify(payload), tourneyMatchId]
          );

          // Advance bracket if in playoffs
          if (match.round > 0 && seriesWinnerCompetitorId) {
            await advancePlayoffWinner(client, String(tourneyMatchId), seriesWinnerCompetitorId);
          }
        } else {
          // Series continues: update current map/series score without finishing match prematurely
          await client.query(
            `UPDATE tournament_matches
             SET score1 = $1, score2 = $2, result = $3
             WHERE id = $4`,
            [displayScore1, displayScore2, JSON.stringify(payload), tourneyMatchId]
          );
        }

        await client.query("COMMIT");

        // Notify tournament bracket and lobby
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(tourneyMatchId)]).catch(() => {});
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
