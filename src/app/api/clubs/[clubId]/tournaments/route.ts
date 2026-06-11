import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import {
  autobalanceMixTeams,
  generateGroupStage,
  generatePlayoffs,
  advancePlayoffWinner,
} from "@/lib/brackets";
import { calculateStandardMatchElo } from "@/lib/elo";
import GameAgentConnector from "@/lib/game-agent";


export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId } = await params;
    const url = new URL(request.url);
    const tournamentId = url.searchParams.get("id");
    const action = url.searchParams.get("action");

    const parsedClubId = parseInt(clubId);

    // 0. Fetch rules templates
    if (action === "rules_templates") {
      const discipline = url.searchParams.get("discipline");
      let queryStr = `SELECT id, name, discipline, rules_text FROM tournament_rules_templates WHERE club_id = $1`;
      let paramsArr: any[] = [parsedClubId];
      if (discipline && discipline !== "all") {
        queryStr += ` AND discipline = $2`;
        paramsArr.push(discipline);
      }
      queryStr += ` ORDER BY name ASC`;
      const templatesRes = await client.query(queryStr, paramsArr);
      return NextResponse.json({ templates: templatesRes.rows });
    }

    // 1. Fetch detailed view of a single tournament
    if (tournamentId) {
      const tournamentRes = await client.query(
        `SELECT * FROM club_tournaments WHERE id = $1 AND club_id = $2`,
        [tournamentId, parsedClubId]
      );

      if (tournamentRes.rowCount === 0) {
        return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
      }

      const tournament = tournamentRes.rows[0];

      // Fetch competitors (including team rosters if applicable)
      const competitorsRes = await client.query(
        `SELECT c.id, c.type, c.display_name, c.team_id, c.player_id, e.status as payment_status,
                t_teams.logo_url as team_logo,
                (
                  SELECT json_agg(json_build_object(
                    'id', p.id,
                    'fullName', p.full_name,
                    'phoneNumber', p.phone_number,
                    'elo', COALESCE(elo.elo, 1000)
                  ))
                  FROM team_members tm
                  JOIN promo_players p ON tm.player_id = p.id
                  LEFT JOIN discipline_elo elo ON p.id = elo.player_id AND elo.discipline = t.discipline
                  WHERE tm.team_id = c.team_id
                ) as team_members
         FROM tournament_competitors c
         JOIN tournament_entries e ON c.id = e.competitor_id
         JOIN club_tournaments t ON c.tournament_id = t.id
         LEFT JOIN teams t_teams ON c.team_id = t_teams.id
         WHERE c.tournament_id = $1`,
        [tournamentId]
      );

      // Fetch matches
      const matchesRes = await client.query(
        `SELECT m.id, m.round, m.order_in_round, m.competitor_a_id, m.competitor_b_id, 
                m.status, m.score1, m.score2, m.cs2_server_id, m.winner_competitor_id, m.result
         FROM tournament_matches m
         WHERE m.tournament_id = $1
         ORDER BY m.round ASC, m.order_in_round ASC`,
        [tournamentId]
      );

      // Fetch payouts
      const payoutsRes = await client.query(
        `SELECT p.id, p.competitor_id, p.prize_type, p.amount, p.item_details, p.status, p.paid_at, u.full_name as paid_by
         FROM tournament_payouts p
         LEFT JOIN users u ON p.paid_by_admin_id = u.id
         WHERE p.tournament_id = $1`,
        [tournamentId]
      );

      return NextResponse.json({
        tournament,
        competitors: competitorsRes.rows,
        matches: matchesRes.rows,
        payouts: payoutsRes.rows,
      });
    }

    // 2. Fetch list of all tournaments for this club
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;

    let tournamentsRes;
    if (playerId) {
      tournamentsRes = await client.query(
        `SELECT t.id, t.name, t.discipline, t.status, t.type, t.entry_fee, t.prize_type, t.fixed_prize_amount, t.prize_pool_mode, t.prize_distribution, t.club_share_pct, t.created_at, t.starts_at, t.config,
                (SELECT COUNT(*)::int FROM tournament_competitors c JOIN tournament_entries e ON c.id = e.competitor_id WHERE c.tournament_id = t.id AND e.status != 'RESERVE') as competitors_count,
                EXISTS (
                  SELECT 1 
                  FROM tournament_competitors c 
                  LEFT JOIN team_members tm ON c.team_id = tm.team_id 
                  WHERE c.tournament_id = t.id AND (c.player_id = $2 OR tm.player_id = $2)
                ) as is_joined
         FROM club_tournaments t
         WHERE t.club_id = $1
         ORDER BY t.created_at DESC`,
        [parsedClubId, playerId]
      );
    } else {
      tournamentsRes = await client.query(
        `SELECT t.id, t.name, t.discipline, t.status, t.type, t.entry_fee, t.prize_type, t.fixed_prize_amount, t.prize_pool_mode, t.prize_distribution, t.club_share_pct, t.created_at, t.starts_at, t.config,
                (SELECT COUNT(*)::int FROM tournament_competitors c JOIN tournament_entries e ON c.id = e.competitor_id WHERE c.tournament_id = t.id AND e.status != 'RESERVE') as competitors_count,
                false as is_joined
         FROM club_tournaments t
         WHERE t.club_id = $1
         ORDER BY t.created_at DESC`,
        [parsedClubId]
      );
    }

    return NextResponse.json({ tournaments: tournamentsRes.rows });
  } catch (error) {
    console.error("Admin Tournaments GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const client = await getClient();
  try {
    const { clubId } = await params;
    const parsedClubId = parseInt(clubId);

    const body = await request.json();
    const { action } = body;

    // Action: CREATE RULES TEMPLATE
    if (action === "create_rules_template") {
      const { discipline, name, rulesText } = body;
      if (!discipline || !name || !rulesText) {
        return NextResponse.json({ error: "Не заполнены поля шаблона" }, { status: 400 });
      }
      await client.query(
        `INSERT INTO tournament_rules_templates (club_id, discipline, name, rules_text)
         VALUES ($1, $2, $3, $4)`,
        [parsedClubId, discipline, name, rulesText]
      );
      return NextResponse.json({ success: true });
    }

    // Action: UPDATE RULES TEMPLATE
    if (action === "update_rules_template") {
      const { templateId, name, rulesText } = body;
      if (!templateId || !name || !rulesText) {
        return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
      }
      await client.query(
        `UPDATE tournament_rules_templates 
         SET name = $1, rules_text = $2
         WHERE id = $3 AND club_id = $4`,
        [name, rulesText, templateId, parsedClubId]
      );
      return NextResponse.json({ success: true });
    }

    // Action: DELETE RULES TEMPLATE
    if (action === "delete_rules_template") {
      const { templateId } = body;
      if (!templateId) {
        return NextResponse.json({ error: "ID шаблона обязателен" }, { status: 400 });
      }
      await client.query(
        `DELETE FROM tournament_rules_templates WHERE id = $1 AND club_id = $2`,
        [templateId, parsedClubId]
      );
      return NextResponse.json({ success: true });
    }

    // Action: CREATE
    if (action === "create") {
      const {
        name,
        discipline,
        type,
        entryFee,
        clubSharePct,
        prizeType,
        prizePoolMode,
        fixedPrizeAmount,
        prizeDistribution,
        rules,
        settings,
        startsAt,
      } = body;

      if (!name || !discipline || !type) {
        return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
      }

      const insertRes = await client.query(
        `INSERT INTO club_tournaments (
          club_id, name, discipline, status, type, entry_fee, club_share_pct,
          prize_type, prize_pool_mode, fixed_prize_amount, prize_distribution, rules, config, starts_at
         )
         VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          parsedClubId,
          name,
          discipline,
          type,
          entryFee || 0.00,
          clubSharePct || 0,
          prizeType || 'combined',
          prizePoolMode || 'fixed',
          fixedPrizeAmount || 0.00,
          JSON.stringify(prizeDistribution || {}),
          rules || "",
          JSON.stringify(settings || { mapPool: ["de_mirage", "de_dust2", "de_inferno"] }),
          startsAt ? new Date(startsAt) : null,
        ]
      );

      return NextResponse.json({ success: true, tournamentId: insertRes.rows[0].id });
    }

    // Action: EDIT TOURNAMENT
    if (action === "edit") {
      const {
        id,
        name,
        discipline,
        type,
        entryFee,
        clubSharePct,
        prizeType,
        prizePoolMode,
        fixedPrizeAmount,
        prizeDistribution,
        rules,
        settings,
        startsAt,
      } = body;

      if (!id || !name || !discipline || !type) {
        return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
      }

      await client.query(
        `UPDATE club_tournaments
         SET name = $1, discipline = $2, type = $3, entry_fee = $4, club_share_pct = $5,
             prize_type = $6, prize_pool_mode = $7, fixed_prize_amount = $8,
             prize_distribution = $9, rules = $10, config = $11, starts_at = $12
         WHERE id = $13 AND club_id = $14`,
        [
          name,
          discipline,
          type,
          entryFee || 0.00,
          clubSharePct || 0,
          prizeType || 'combined',
          prizePoolMode || 'fixed',
          fixedPrizeAmount || 0.00,
          JSON.stringify(prizeDistribution || {}),
          rules || "",
          JSON.stringify(settings || { mapPool: ["de_mirage", "de_dust2", "de_inferno"] }),
          startsAt ? new Date(startsAt) : null,
          id,
          parsedClubId
        ]
      );

      return NextResponse.json({ success: true });
    }

    // Action: DELETE TOURNAMENT
    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: "Не передан ID турнира" }, { status: 400 });
      }

      await client.query(
        `DELETE FROM club_tournaments WHERE id = $1 AND club_id = $2`,
        [id, parsedClubId]
      );

      return NextResponse.json({ success: true });
    }

    // Action: UPDATE RULES
    if (action === "update_rules") {
      const { id, rules } = body;
      await client.query("UPDATE club_tournaments SET rules = $1 WHERE id = $2 AND club_id = $3", [rules, id, parsedClubId]);
      return NextResponse.json({ success: true });
    }

    // Action: CONFIRM PAYMENT
    if (action === "confirm_payment") {
      const { id, competitorId } = body; // id = tournamentId
      await client.query(
        `UPDATE tournament_entries 
         SET status = 'PAID'
         WHERE tournament_id = $1 AND competitor_id = $2`,
        [id, competitorId]
      );
      return NextResponse.json({ success: true });
    }

    // Action: DELETE COMPETITOR (cancel registration)
    if (action === "delete_competitor") {
      const { id, competitorId } = body; // id = tournamentId
      await client.query("BEGIN");
      
      const tourneyRes = await client.query(`SELECT status FROM club_tournaments WHERE id = $1`, [id]);
      if (tourneyRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
      }
      if (tourneyRes.rows[0].status !== "REGISTRATION" && tourneyRes.rows[0].status !== "DRAFT") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Нельзя удалять участников после запуска турнира" }, { status: 400 });
      }

      await client.query(
        `DELETE FROM tournament_entries WHERE tournament_id = $1 AND competitor_id = $2`,
        [id, competitorId]
      );
      await client.query(
        `DELETE FROM tournament_competitors WHERE id = $1`,
        [competitorId]
      );
      
      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    }

    // Action: PROMOTE COMPETITOR FROM RESERVE
    if (action === "promote_competitor") {
      const { id, competitorId } = body; // id = tournamentId
      
      const tourneyRes = await client.query(`SELECT entry_fee FROM club_tournaments WHERE id = $1`, [id]);
      if (tourneyRes.rows.length === 0) {
        return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
      }
      
      const fee = parseFloat(tourneyRes.rows[0].entry_fee);
      const nextStatus = fee === 0 ? "PAID" : "PENDING_PAYMENT";
      
      await client.query(
        `UPDATE tournament_entries 
         SET status = $3
         WHERE tournament_id = $1 AND competitor_id = $2`,
         [id, competitorId, nextStatus]
      );
      return NextResponse.json({ success: true });
    }

    // Action: START TOURNAMENT (autobalaance mixes, lock prize pool, generate matches)
    if (action === "start") {
      const { id } = body; // id = tournamentId

      await client.query("BEGIN");

      const tournamentRes = await client.query(
        `SELECT * FROM club_tournaments WHERE id = $1 AND club_id = $2`,
        [id, parsedClubId]
      );
      if (tournamentRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
      }

      const tournament = tournamentRes.rows[0];
      if (tournament.status !== "DRAFT" && tournament.status !== "REGISTRATION") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Турнир уже запущен" }, { status: 400 });
      }

      let paidCompetitors: string[] = [];

      const isMix = tournament.type === "mix" || tournament.type === "mix_2vs2" || tournament.type === "mix_5vs5";
      if (isMix) {
        // Fetch all registered players who have paid
        const playersRes = await client.query(
          `SELECT c.player_id as id, p.full_name, COALESCE(e.elo, 1000) as elo
           FROM tournament_competitors c
           JOIN tournament_entries ent ON c.id = ent.competitor_id
           JOIN promo_players p ON c.player_id = p.id
           LEFT JOIN discipline_elo e ON p.id = e.player_id AND e.discipline = $2
           WHERE c.tournament_id = $1 AND ent.status = 'PAID'`,
          [id, tournament.discipline]
        );

        const players = playersRes.rows.map(r => ({
          id: r.id,
          fullName: r.full_name,
          elo: parseInt(r.elo),
        }));

        const teamSize = tournament.type === "mix_2vs2" ? 2 : 5;
        const minPlayers = teamSize * 2;

        if (players.length < minPlayers) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: `Недостаточно игроков для запуска микс-турнира (минимум ${minPlayers} игроков)` }, { status: 400 });
        }

        // Run ELO Autobalance and register mixed teams
        paidCompetitors = await autobalanceMixTeams(client, parsedClubId, id, players, teamSize);
      } else {
        // Standard solo/team registration
        const compsRes = await client.query(
          `SELECT competitor_id 
           FROM tournament_entries 
           WHERE tournament_id = $1 AND status = 'PAID'`,
          [id]
        );
        paidCompetitors = compsRes.rows.map(r => r.competitor_id);
      }

      if (paidCompetitors.length < 2) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Для старта турнира требуется минимум 2 оплативших участника" }, { status: 400 });
      }

      // Generate Group Stage (round = 0)
      // For simple LAN, if competitor count <= 4, do direct playoffs. If > 4, do Group Stage + Playoff
      if (paidCompetitors.length > 4) {
        await generateGroupStage(client, id, paidCompetitors);
      } else {
        await generatePlayoffs(client, id, paidCompetitors);
      }

      // Update status to active
      await client.query(
        `UPDATE club_tournaments SET status = 'ACTIVE' WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    }

    // Action: FINISH MATCH (Manual entry for FIFA/UFC)
    if (action === "finish_match") {
      const { matchId, score1, score2 } = body;
      if (score1 === undefined || score2 === undefined) {
        return NextResponse.json({ error: "Внесите счет матча" }, { status: 400 });
      }

      await client.query("BEGIN");

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id, m.status, t.discipline
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1`,
        [matchId]
      );

      if (matchRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
      }

      const match = matchRes.rows[0];
      if (match.status === "FINISHED") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Матч уже завершен" }, { status: 400 });
      }

      const winnerId = score1 > score2 ? match.competitor_a_id : match.competitor_b_id;

      // Update match result
      await client.query(
        `UPDATE tournament_matches
         SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3
         WHERE id = $4`,
        [score1, score2, winnerId, matchId]
      );

      // Recalculate ELO (Only if it is a Solo tournament)
      if (match.competitor_a_id && match.competitor_b_id) {
        const compARes = await client.query(`SELECT player_id FROM tournament_competitors WHERE id = $1`, [match.competitor_a_id]);
        const compBRes = await client.query(`SELECT player_id FROM tournament_competitors WHERE id = $1`, [match.competitor_b_id]);

        const playerAId = compARes.rows[0]?.player_id;
        const playerBId = compBRes.rows[0]?.player_id;

        if (playerAId && playerBId) {
          // Fetch existing ELOs and matches count
          const eloARes = await client.query(
            `SELECT elo, matches_played FROM discipline_elo WHERE player_id = $1 AND discipline = $2`,
            [playerAId, match.discipline]
          );
          const eloBRes = await client.query(
            `SELECT elo, matches_played FROM discipline_elo WHERE player_id = $1 AND discipline = $2`,
            [playerBId, match.discipline]
          );

          const eloA = eloARes.rows[0]?.elo || 1000;
          const eloB = eloBRes.rows[0]?.elo || 1000;
          const matchesA = eloARes.rows[0]?.matches_played || 0;
          const matchesB = eloBRes.rows[0]?.matches_played || 0;

          const eloRes = calculateStandardMatchElo(eloA, eloB, matchesA, matchesB, score1 > score2);

          // Update DB
          await client.query(
            `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
             VALUES ($1, $2, $3, 1, false)
             ON CONFLICT (player_id, discipline)
             DO UPDATE SET elo = $3, matches_played = discipline_elo.matches_played + 1, is_calibrated = (discipline_elo.matches_played + 1 >= 5), updated_at = NOW()`,
            [playerAId, match.discipline, eloRes.p1NewElo]
          );

          await client.query(
            `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
             VALUES ($1, $2, $3, 1, false)
             ON CONFLICT (player_id, discipline)
             DO UPDATE SET elo = $3, matches_played = discipline_elo.matches_played + 1, is_calibrated = (discipline_elo.matches_played + 1 >= 5), updated_at = NOW()`,
            [playerBId, match.discipline, eloRes.p2NewElo]
          );
        }
      }

      // Advance winner in playoffs
      if (match.round > 0) {
        await advancePlayoffWinner(client, matchId, winnerId);
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    }

    // Action: PAYOUT PRIZE
    if (action === "payout") {
      const { tournamentId, competitorId, prizeType, amount, itemDetails } = body;
      const cookieStore = await cookies();
      const adminId = cookieStore.get("session_user_id")?.value || body.adminId;

      if (!tournamentId || !competitorId || !prizeType) {
        return NextResponse.json({ error: "Недостаточно данных для выплаты" }, { status: 400 });
      }

      await client.query("BEGIN");

      // Verify the competitor exists
      const compRes = await client.query(`SELECT type, team_id, player_id FROM tournament_competitors WHERE id = $1`, [competitorId]);
      if (compRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Победитель не найден" }, { status: 404 });
      }

      const competitor = compRes.rows[0];

      // Auto-Credit Balance if type = bonus or combined (checks bonusAmount)
      const isBonus = prizeType === "bonus";
      const isCombined = prizeType === "combined";
      const bonusAmount = body.bonusAmount ? parseFloat(body.bonusAmount) : 0;
      const creditAmount = isBonus ? parseFloat(amount) : bonusAmount;

      if ((isBonus || isCombined) && creditAmount > 0) {
        if (competitor.type === "TEAM") {
          // Fetch members to split the bonus
          const membersRes = await client.query(`SELECT player_id FROM team_members WHERE team_id = $1`, [competitor.team_id]);
          const numMembers = membersRes.rows.length;
          if (numMembers > 0) {
            const splitAmount = creditAmount / numMembers;
            for (const member of membersRes.rows) {
              await client.query(
                `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (player_id, club_id)
                 DO UPDATE SET bonus_balance = promo_player_balances.bonus_balance + $3, updated_at = NOW()`,
                [member.player_id, parsedClubId, splitAmount]
              );
            }
          }
        } else {
          // Solo player
          await client.query(
            `INSERT INTO promo_player_balances (player_id, club_id, bonus_balance)
             VALUES ($1, $2, $3)
             ON CONFLICT (player_id, club_id)
             DO UPDATE SET bonus_balance = promo_player_balances.bonus_balance + $3, updated_at = NOW()`,
            [competitor.player_id, parsedClubId, creditAmount]
          );
        }
      }

      // Record in Payouts ledger
      await client.query(
        `INSERT INTO tournament_payouts (tournament_id, competitor_id, prize_type, amount, item_details, status, paid_at, paid_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), $6)`,
        [tournamentId, competitorId, prizeType, amount || 0.00, itemDetails || "", adminId]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    }

    // Action: SYNC MATCH STATS (CS2 automatic stats fetching)
    if (action === "sync_match_stats") {
      const { matchId } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.round, m.competitor_a_id, m.competitor_b_id, m.status, m.cs2_server_id, t.discipline
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1`,
        [matchId]
      );

      if (matchRes.rowCount === 0) {
        return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
      }

      const match = matchRes.rows[0];
      if (match.status === "FINISHED") {
        return NextResponse.json({ error: "Матч уже завершен" }, { status: 400 });
      }
      if (!match.cs2_server_id) {
        return NextResponse.json({ error: "Для этого матча не запущен сервер CS2" }, { status: 400 });
      }

      const agentUrl = process.env.GAME_AGENT_URL || "http://127.0.0.1:5000";
      const agent = new GameAgentConnector(agentUrl);
      
      let statsPayload;
      try {
        statsPayload = await agent.getMatchStats(`match_${match.cs2_server_id}`);
      } catch (e: any) {
        return NextResponse.json({ error: `Не удалось получить статистику от агента: ${e.message}` }, { status: 500 });
      }

      const team1Score = statsPayload.team1?.score ?? 0;
      const team2Score = statsPayload.team2?.score ?? 0;
      const team1PlayersRaw = statsPayload.team1?.players ?? [];
      const team2PlayersRaw = statsPayload.team2?.players ?? [];

      if (team1Score === 0 && team2Score === 0) {
        return NextResponse.json({ error: "Статистика матча пуста (счет 0:0)" }, { status: 400 });
      }

      await client.query("BEGIN");

      // Helper to map raw SteamID players to ELO inputs
      const mapPlayersToElo = async (playersRaw: any[]) => {
        const result = [];
        for (const raw of playersRaw) {
          const steamId = String(raw.steamid);
          const pRes = await client.query(`SELECT id FROM promo_players WHERE steam_id = $1`, [steamId]);
          if (pRes.rows.length > 0) {
            const playerId = pRes.rows[0].id;
            const eloRes = await client.query(
              `SELECT elo, matches_played FROM discipline_elo WHERE player_id = $1 AND discipline = 'cs2'`,
              [playerId]
            );
            result.push({
              playerId,
              elo: eloRes.rows[0]?.elo ?? 1000,
              matchesPlayed: eloRes.rows[0]?.matches_played ?? 0,
              adr: parseFloat(raw.adr ?? 0),
            });
          }
        }
        return result;
      };

      const team1Players = await mapPlayersToElo(team1PlayersRaw);
      const team2Players = await mapPlayersToElo(team2PlayersRaw);

      const team1Won = team1Score > team2Score;
      const winnerCompetitorId = team1Won ? match.competitor_a_id : match.competitor_b_id;

      // Update match details
      await client.query(
        `UPDATE tournament_matches
         SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3
         WHERE id = $4`,
        [team1Score, team2Score, winnerCompetitorId, matchId]
      );

      // Calculate and save CS2 ELO adjustments
      if (team1Players.length > 0 && team2Players.length > 0) {
        const { calculateCs2MatchElo } = await import("@/lib/elo");
        const eloResults = calculateCs2MatchElo(team1Players, team2Players, team1Won);

        for (const res of eloResults) {
          await client.query(
            `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
             VALUES ($1, 'cs2', $2, 1, $3)
             ON CONFLICT (player_id, discipline)
             DO UPDATE SET elo = $2, matches_played = discipline_elo.matches_played + 1, is_calibrated = $3, updated_at = NOW()`,
            [res.playerId, res.newElo, res.isCalibrated]
          );
        }
      }

      // Advance winner in playoffs
      if (match.round > 0) {
        await advancePlayoffWinner(client, matchId, winnerCompetitorId);
      }

      // Stop CS2 server
      try {
        await agent.stopServer(match.cs2_server_id);
      } catch (err) {
        console.error("Failed to stop server after match sync:", err);
      }

      await client.query("COMMIT");

      // Notify clients
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [matchId]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error) {
    console.error("Admin Tournaments POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
