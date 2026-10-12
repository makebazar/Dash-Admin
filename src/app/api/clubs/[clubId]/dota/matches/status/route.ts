import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { ensureDotaTables } from "@/lib/dota/server-manager";
import { advancePlayoffWinner } from "@/lib/brackets";
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

    if (!rawMatchId) {
      return NextResponse.json({ error: "match_id обязателен" }, { status: 400 });
    }

    const cleanMatchId = rawMatchId
      .replace(/^dm-dota-/, "")
      .replace(/^dm-tourney-/, "")
      .replace(/^dm-/, "");
    const numMatchId = parseInt(cleanMatchId, 10);
    const dmMatchId = `dm-dota-${cleanMatchId}`;

    console.log(`[Dota Status API] Club ${parsedClubId} Match ${cleanMatchId} status: ${status}`, extra);

    // 1. Fetch tournament match
    const matchRes = await client.query(
      `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id,
              m.status, m.score1, m.score2, m.result, t.club_id
       FROM tournament_matches m
       JOIN club_tournaments t ON m.tournament_id = t.id
       WHERE m.id = $1 AND t.club_id = $2`,
      [numMatchId, parsedClubId]
    ).catch(() => ({ rowCount: 0, rows: [] }));

    const match = matchRes.rows[0];

    // 2. Update club_dota_matches table
    if (status === "starting") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'starting',
             game_name = COALESCE($1, game_name),
             password = COALESCE($2, password),
             game_mode = COALESCE($3, game_mode),
             server_region = COALESCE($4, server_region),
             updated_at = NOW()
         WHERE (id = $5 OR tournament_match_id = $6) AND club_id = $7`,
        [extra.game_name, extra.password, extra.game_mode, extra.region, dmMatchId, numMatchId, parsedClubId]
      ).catch(() => {});
    } else if (status === "lobby_ready") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'lobby_ready',
             lobby_id = COALESCE($1, lobby_id),
             password = COALESCE($2, password),
             game_name = COALESCE($3, game_name),
             updated_at = NOW()
         WHERE (id = $4 OR tournament_match_id = $5) AND club_id = $6`,
        [extra.lobby_id ? String(extra.lobby_id) : null, extra.password, extra.game_name, dmMatchId, numMatchId, parsedClubId]
      ).catch(() => {});
    } else if (status === "live") {
      await client.query(
        `UPDATE club_dota_matches
         SET status = 'live', updated_at = NOW()
         WHERE (id = $1 OR tournament_match_id = $2) AND club_id = $3`,
        [dmMatchId, numMatchId, parsedClubId]
      ).catch(() => {});
    } else if (status === "finished") {
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
          extra.radiant_score ?? 0,
          extra.dire_score ?? 0,
          extra.winner || (extra.radiant_win ? "radiant" : "dire"),
          extra.duration ?? 0,
          JSON.stringify(extra),
          dmMatchId,
          numMatchId,
          parsedClubId,
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
      if (status === "starting") {
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
            numMatchId,
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
            numMatchId,
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
          [numMatchId]
        ).catch(() => {});
      } else if (status === "finished" && match.status !== "FINISHED") {
        await client.query("BEGIN");

        const radiantWon = extra.radiant_win === true || extra.winner === "radiant";
        const winnerCompetitorId = radiantWon ? match.competitor_a_id : match.competitor_b_id;
        const loserCompetitorId = radiantWon ? match.competitor_b_id : match.competitor_a_id;

        const score1 = extra.radiant_score ?? (radiantWon ? 1 : 0);
        const score2 = extra.dire_score ?? (!radiantWon ? 1 : 0);

        const updatedResult = {
          ...(match.result || {}),
          dota_stats: extra,
          winner: extra.winner || (radiantWon ? "radiant" : "dire"),
          duration: extra.duration || 0,
          radiant_score: extra.radiant_score || 0,
          dire_score: extra.dire_score || 0,
        };

        await client.query(
          `UPDATE tournament_matches
           SET score1 = $1, score2 = $2, status = 'FINISHED',
               winner_competitor_id = $3, result = $4::jsonb
           WHERE id = $5`,
          [score1, score2, winnerCompetitorId, JSON.stringify(updatedResult), numMatchId]
        );

        // Advance bracket
        if (match.round > 0 && winnerCompetitorId) {
          try {
            await advancePlayoffWinner(client, String(numMatchId), winnerCompetitorId);
          } catch (advErr) {
            console.error(`[Dota Status API] advancePlayoffWinner error for match ${numMatchId}:`, advErr);
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

        if (match.tournament_id) {
          await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        }
      } else if (status === "stopped") {
        await client.query(
          `UPDATE tournament_matches SET status = 'PENDING' WHERE id = $1 AND status != 'FINISHED'`,
          [numMatchId]
        ).catch(() => {});
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
