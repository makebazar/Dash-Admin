import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { ensureDotaTables, launchDotaMatch, releaseDotaBot, processDotaQueue } from "@/lib/dota/server-manager";
import { advancePlayoffWinner, resolveMatchFormat } from "@/lib/brackets";
import { calculateStandardMatchElo } from "@/lib/elo";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId } = await params;
    const parsedClubId = parseInt(clubId, 10);
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Некорректный ID клуба" }, { status: 400 });
    }

    await ensureDotaTables(client);

    const body = await request.json().catch(() => ({}));
    const rawMatchId = String(body.match_id || "").trim();
    const status = String(body.status || "").toLowerCase();
    const extra = body.extra || {};
    const reportedBotId = body.bot_id || extra.bot_id || body.botId || extra.botId || null;

    if (!rawMatchId) {
      return NextResponse.json({ error: "match_id обязателен" }, { status: 400 });
    }

    const cleanMatchId = rawMatchId
      .replace(/^dm-dota-/, "")
      .replace(/^dm-tourney-/, "")
      .replace(/^dm-/, "");
    const numMatchId = parseInt(cleanMatchId, 10);
    const dmMatchId = `dm-dota-${cleanMatchId}`;

    console.log(`[Dota Status API] Club ${parsedClubId} Match ${cleanMatchId} status: ${status}`, extra, `bot_id: ${reportedBotId}`);

    // 1. Fetch tournament match
    let matchRes = await client.query(
      `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id,
              m.status, m.score1, m.score2, m.result, t.club_id, t.config as tournament_config
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1 AND t.club_id = $2`,
      [numMatchId, parsedClubId]
    ).catch(() => ({ rowCount: 0, rows: [] }));

    let match = matchRes.rows[0];
    let resolvedMatchId = numMatchId;

    if (!match) {
      const dotaMatchLookup = await client.query(
        `SELECT tournament_match_id FROM club_dota_matches
         WHERE (id = $1 OR lobby_id = $2 OR tournament_match_id = $3) AND club_id = $4`,
        [dmMatchId, cleanMatchId, isNaN(numMatchId) ? null : numMatchId, parsedClubId]
      ).catch(() => ({ rows: [] }));

      const tourneyId = dotaMatchLookup.rows[0]?.tournament_match_id;
      if (tourneyId) {
        resolvedMatchId = parseInt(String(tourneyId), 10);
        matchRes = await client.query(
          `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id,
                  m.status, m.score1, m.score2, m.result, t.club_id, t.config as tournament_config
           FROM tournament_matches m
           JOIN club_tournaments t ON m.tournament_id = t.id
           WHERE m.id = $1 AND t.club_id = $2`,
          [resolvedMatchId, parsedClubId]
        ).catch(() => ({ rowCount: 0, rows: [] }));
        match = matchRes.rows[0];
      }
    }

    // 2. Update club_dota_matches table
    if (status === "waiting_bot" || status === "waiting_server" || status === "queue") {
      const qPos = extra.queue_position || extra.position || 1;
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'waiting_server',
             extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{queue_position}', $1::jsonb),
             updated_at = NOW()
         WHERE (id = $2 OR tournament_match_id = $3) AND club_id = $4`,
        [JSON.stringify(qPos), dmMatchId, numMatchId, parsedClubId]
      ).catch(() => {});
    } else if (status === "starting") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'starting',
             game_name = COALESCE($1, game_name),
             password = COALESCE($2, password),
             game_mode = COALESCE($3, game_mode),
             server_region = COALESCE($4, server_region),
             bot_id = COALESCE($8, bot_id),
             updated_at = NOW()
         WHERE (id = $5 OR tournament_match_id = $6) AND club_id = $7`,
        [extra.game_name, extra.password, extra.game_mode, extra.region, dmMatchId, numMatchId, parsedClubId, reportedBotId]
      ).catch(() => {});
    } else if (status === "lobby_ready") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'lobby_ready',
             lobby_id = COALESCE($1, lobby_id),
             password = COALESCE($2, password),
             game_name = COALESCE($3, game_name),
             bot_id = COALESCE($7, bot_id),
             updated_at = NOW()
         WHERE (id = $4 OR tournament_match_id = $5) AND club_id = $6`,
        [extra.lobby_id ? String(extra.lobby_id) : null, extra.password, extra.game_name, dmMatchId, numMatchId, parsedClubId, reportedBotId]
      ).catch(() => {});
    } else if (status === "live") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'live',
             bot_id = COALESCE($4, bot_id),
             updated_at = NOW()
         WHERE (id = $1 OR tournament_match_id = $2) AND club_id = $3`,
        [dmMatchId, numMatchId, parsedClubId, reportedBotId]
      ).catch(() => {});
    } else if (status === "finished") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'finished',
             score1 = $1,
             score2 = $2,
             winner = $3,
             duration = $4,
             bot_id = COALESCE($9, bot_id),
             extra = $5::jsonb,
             updated_at = NOW()
         WHERE (id = $6 OR tournament_match_id = $7) AND club_id = $8`,
        [
          extra.radiant_score ?? 0,
          extra.dire_score ?? 0,
          extra.winner || (extra.radiant_win ? "radiant" : "dire"),
          extra.duration ?? 0,
          JSON.stringify(extra),
          dmMatchId,
          numMatchId,
          parsedClubId,
          reportedBotId,
        ]
      ).catch(() => {});
    } else if (status === "stopped" || status === "failed") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = $1, updated_at = NOW()
         WHERE (id = $2 OR tournament_match_id = $3) AND club_id = $4`,
        [status, dmMatchId, numMatchId, parsedClubId]
      ).catch(() => {});
    }

    // 3. Update tournament_matches state
    if (match) {
      if (status === "waiting_bot" || status === "waiting_server" || status === "queue") {
        const qPos = extra.queue_position || extra.position || 1;
        await client.query(
          `UPDATE tournament_matches
           SET status = 'WAITING_SERVER',
               result = jsonb_set(
                 COALESCE(result, '{}'::jsonb),
                 '{dota_lobby}',
                 COALESCE(result->'dota_lobby', '{}'::jsonb) || $1::jsonb
               )
           WHERE id = $2 AND status != 'FINISHED'`,
          [
            JSON.stringify({
              status: "waiting_server",
              queue_position: qPos,
            }),
            resolvedMatchId,
          ]
        ).catch(() => {});
      } else if (status === "starting") {
        await client.query(
          `UPDATE tournament_matches
           SET status = 'STARTING',
               result = jsonb_set(
                 COALESCE(result, '{}'::jsonb),
                 '{dota_lobby}',
                 COALESCE(result->'dota_lobby', '{}'::jsonb) || $1::jsonb
               )
           WHERE id = $2 AND status != 'FINISHED'`,
          [
            JSON.stringify({
              game_name: extra.game_name,
              password: extra.password,
              state: "starting",
            }),
            resolvedMatchId,
          ]
        ).catch(() => {});
      } else if (status === "lobby_ready") {
        await client.query(
          `UPDATE tournament_matches
           SET status = 'READY',
               result = jsonb_set(
                 COALESCE(result, '{}'::jsonb),
                 '{dota_lobby}',
                 COALESCE(result->'dota_lobby', '{}'::jsonb) || $1::jsonb
               )
           WHERE id = $2 AND status != 'FINISHED'`,
          [
            JSON.stringify({
              lobby_id: String(extra.lobby_id || ""),
              password: extra.password,
              game_name: extra.game_name,
              state: "lobby_ready",
            }),
            resolvedMatchId,
          ]
        ).catch(() => {});
      } else if (status === "live") {
        await client.query(
          `UPDATE tournament_matches
           SET status = 'LIVE',
               result = jsonb_set(
                 COALESCE(result, '{}'::jsonb),
                 '{dota_lobby,state}',
                 '"live"'::jsonb
               )
           WHERE id = $1 AND status != 'FINISHED'`,
          [resolvedMatchId]
        ).catch(() => {});
      } else if (status === "finished" && match.status !== "FINISHED") {
        await client.query("BEGIN");

        // 1. Identify which competitor won this game (lobby)
        const dotaLobby = match.result?.dota_lobby || {};
        const isFlipped = Boolean(dotaLobby.flipped);
        const radiantCompId = dotaLobby.radiant_competitor_id || (isFlipped ? match.competitor_b_id : match.competitor_a_id);
        const direCompId = dotaLobby.dire_competitor_id || (isFlipped ? match.competitor_a_id : match.competitor_b_id);

        const radiantWon = extra.radiant_win === true || extra.winner === "radiant";
        const gameWinnerCompId = radiantWon ? radiantCompId : direCompId;
        const gameLoserCompId = radiantWon ? direCompId : radiantCompId;

        // 2. Resolve series format (BO1, BO3, BO5)
        const tConfig = match.tournament_config || {};
        const resolvedFormat = resolveMatchFormat(tConfig, match.round, undefined, match.result);
        const numGames = resolvedFormat === "bo5" ? 5 : (resolvedFormat === "bo3" ? 3 : 1);
        const winsNeeded = Math.ceil(numGames / 2); // 1 for bo1, 2 for bo3, 3 for bo5

        // 3. Update dota_games history
        const existingGames = Array.isArray(match.result?.dota_games)
          ? match.result.dota_games
          : (Array.isArray(match.result?.dota_series?.games) ? match.result.dota_series.games : []);

        const gameNum = existingGames.length + 1;
        const newGameRecord = {
          game_number: gameNum,
          winner: radiantWon ? "radiant" : "dire",
          radiant_won: radiantWon,
          winner_competitor_id: gameWinnerCompId,
          radiant_competitor_id: radiantCompId,
          dire_competitor_id: direCompId,
          radiant_score: extra.radiant_score ?? 0,
          dire_score: extra.dire_score ?? 0,
          duration: extra.duration ?? 0,
          steam_match_id: extra.steam_match_id || extra.dota_match_id || null,
          finished_at: new Date().toISOString(),
        };

        const updatedGames = [...existingGames, newGameRecord];

        // Series score (games won in the series by competitor A and competitor B)
        const seriesScore1 = updatedGames.filter((g: any) => String(g.winner_competitor_id) === String(match.competitor_a_id)).length;
        const seriesScore2 = updatedGames.filter((g: any) => String(g.winner_competitor_id) === String(match.competitor_b_id)).length;

        const isSeriesFinished = seriesScore1 >= winsNeeded || seriesScore2 >= winsNeeded || updatedGames.length >= numGames;

        if (isSeriesFinished) {
          const winnerCompetitorId = seriesScore1 >= winsNeeded
            ? match.competitor_a_id
            : (seriesScore2 >= winsNeeded ? match.competitor_b_id : (seriesScore1 >= seriesScore2 ? match.competitor_a_id : match.competitor_b_id));
          const loserCompetitorId = String(winnerCompetitorId) === String(match.competitor_a_id) ? match.competitor_b_id : match.competitor_a_id;

          const updatedResult = {
            ...(match.result || {}),
            dota_games: updatedGames,
            dota_stats: extra,
            players: extra.players || (match.result || {}).players || [],
            winner: String(winnerCompetitorId) === String(match.competitor_a_id) ? "competitor_a" : "competitor_b",
            duration: (match.result?.duration || 0) + (extra.duration || 0),
            radiant_score: extra.radiant_score ?? 0,
            dire_score: extra.dire_score ?? 0,
            series_format: resolvedFormat,
            series_score1: seriesScore1,
            series_score2: seriesScore2,
          };

          await client.query(
            `UPDATE tournament_matches
             SET score1 = $1, score2 = $2, status = 'FINISHED',
                 winner_competitor_id = $3, result = $4::jsonb
             WHERE id = $5`,
            [seriesScore1, seriesScore2, winnerCompetitorId, JSON.stringify(updatedResult), resolvedMatchId]
          );

          await client.query(
            `UPDATE club_dota_matches
             SET status = 'finished',
                 score1 = $1,
                 score2 = $2,
                 winner = $3,
                 duration = $4,
                 extra = $5::jsonb,
                 updated_at = NOW()
             WHERE (id = $6 OR tournament_match_id = $7) AND club_id = $8`,
            [
              seriesScore1,
              seriesScore2,
              String(winnerCompetitorId) === String(match.competitor_a_id) ? "team1" : "team2",
              extra.duration ?? 0,
              JSON.stringify(extra),
              dmMatchId,
              numMatchId,
              parsedClubId,
            ]
          );

          // Advance bracket
          if (match.round > 0 && winnerCompetitorId) {
            try {
              await advancePlayoffWinner(client, String(resolvedMatchId), winnerCompetitorId);
            } catch (advErr) {
              console.error(`[Dota Status API] advancePlayoffWinner error for match ${resolvedMatchId}:`, advErr);
            }
          }

          // Update Dota 2 ELO rating for competitors if solo/1v1
          try {
            const compRes = await client.query(
              `SELECT id, player_id FROM tournament_competitors WHERE id IN ($1, $2)`,
              [winnerCompetitorId, loserCompetitorId]
            );
            const p1Id = compRes.rows.find((r: any) => String(r.id) === String(winnerCompetitorId))?.player_id;
            const p2Id = compRes.rows.find((r: any) => String(r.id) === String(loserCompetitorId))?.player_id;

            if (p1Id && p2Id) {
              const eloRes = await client.query(
                `SELECT player_id, elo, matches_played FROM discipline_elo WHERE player_id IN ($1, $2) AND discipline = 'dota2'`,
                [p1Id, p2Id]
              );
              const p1EloRow = eloRes.rows.find((r: any) => String(r.player_id) === String(p1Id));
              const p2EloRow = eloRes.rows.find((r: any) => String(r.player_id) === String(p2Id));

              const p1Elo = p1EloRow?.elo ?? 1000;
              const p2Elo = p2EloRow?.elo ?? 1000;
              const p1Matches = p1EloRow?.matches_played ?? 0;
              const p2Matches = p2EloRow?.matches_played ?? 0;

              const eloCalc = calculateStandardMatchElo(p1Elo, p2Elo, p1Matches, p2Matches, true);

              await client.query(
                `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated, updated_at)
                 VALUES ($1, 'dota2', $2, 1, $3, NOW())
                 ON CONFLICT (player_id, discipline)
                 DO UPDATE SET elo = $2, matches_played = discipline_elo.matches_played + 1, is_calibrated = $3, updated_at = NOW()`,
                [p1Id, eloCalc.p1NewElo, p1Matches + 1 >= 5]
              );
              await client.query(
                `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated, updated_at)
                 VALUES ($1, 'dota2', $2, 1, $3, NOW())
                 ON CONFLICT (player_id, discipline)
                 DO UPDATE SET elo = $2, matches_played = discipline_elo.matches_played + 1, is_calibrated = $3, updated_at = NOW()`,
                [p2Id, eloCalc.p2NewElo, p2Matches + 1 >= 5]
              );
            }
          } catch (eloErr) {
            console.warn("[Dota Status API] ELO update note:", eloErr);
          }

          await client.query("COMMIT");

          // Release bot back to the pool and auto-start next queued match
          const assignedBotId = reportedBotId || match.result?.dota_lobby?.bot_id || null;
          await releaseDotaBot(client, parsedClubId, resolvedMatchId, assignedBotId);

          if (match.tournament_id) {
            await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
          }

          return NextResponse.json({
            success: true,
            status: "series_finished",
            is_series_finished: true,
            release_bot: true,
            bot_id: assignedBotId,
            winner_id: winnerCompetitorId,
            series_score1: seriesScore1,
            series_score2: seriesScore2,
          });
        } else {
          // Series continues (e.g. 1:0 in BO3, or 1:1 in BO3, or 2:1 in BO5)
          const nextGameNum = gameNum + 1;
          const nextFlipped = !isFlipped; // Swap sides: Radiant <-> Dire
          const assignedBotId = reportedBotId || match.result?.dota_lobby?.bot_id || null;

          const updatedResult = {
            ...(match.result || {}),
            dota_games: updatedGames,
            current_game_number: nextGameNum,
            series_format: resolvedFormat,
            series_score1: seriesScore1,
            series_score2: seriesScore2,
            dota_lobby: {
              ...dotaLobby,
              bot_id: assignedBotId,
              keep_bot: true,
              is_series_finished: false,
              flipped: nextFlipped,
              status: "starting",
              state: "starting",
            },
          };

          await client.query(
            `UPDATE tournament_matches
             SET score1 = $1, score2 = $2, status = 'LIVE', result = $3::jsonb
             WHERE id = $4`,
            [seriesScore1, seriesScore2, JSON.stringify(updatedResult), resolvedMatchId]
          );

          await client.query(
            `UPDATE club_dota_matches
             SET status = 'starting',
                 score1 = $1,
                 score2 = $2,
                 bot_id = COALESCE($3, bot_id),
                 updated_at = NOW()
             WHERE (id = $4 OR tournament_match_id = $5) AND club_id = $6`,
            [seriesScore1, seriesScore2, assignedBotId, dmMatchId, numMatchId, parsedClubId]
          );

          await client.query("COMMIT");

          if (match.tournament_id) {
            await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
          }

          // Automatically launch lobby for the next game in the series KEEPING THE SAME BOT
          try {
            await launchDotaMatch(client, parsedClubId, resolvedMatchId, {
              flipSides: nextFlipped,
              botId: assignedBotId || undefined,
              keepBot: true,
              gameName: `DashMatch #${resolvedMatchId} (Игра ${nextGameNum})`,
            });
          } catch (autoErr) {
            console.error(`[Dota Status API] Auto-launching next Dota game ${nextGameNum} failed:`, autoErr);
          }

          await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(resolvedMatchId)]).catch(() => {});

          return NextResponse.json({
            success: true,
            status: "next_game_started",
            is_series_finished: false,
            keep_bot: true,
            bot_id: assignedBotId,
            series_score1: seriesScore1,
            series_score2: seriesScore2,
            game_number: nextGameNum,
            message: `Игра ${gameNum} завершена (${seriesScore1}:${seriesScore2}). Создано лобби для Игры ${nextGameNum} с тем же ботом (${assignedBotId || "pool"}).`,
          });
        }
      } else if (status === "stopped") {
        await client.query(
          `UPDATE tournament_matches SET status = 'PENDING' WHERE id = $1 AND status != 'FINISHED'`,
          [resolvedMatchId || numMatchId]
        ).catch(() => {});
        const assignedBotId = reportedBotId || match.result?.dota_lobby?.bot_id || null;
        await releaseDotaBot(client, parsedClubId, resolvedMatchId || numMatchId, assignedBotId);
      }
    }

    // Real-time notification for tournament lobby
    await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(cleanMatchId)]).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Dota Match Status API Error]", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
