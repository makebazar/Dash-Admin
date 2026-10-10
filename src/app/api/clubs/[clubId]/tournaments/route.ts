import { NextResponse } from "next/server";
import { getClient } from "@/db";
import { cookies } from "next/headers";
import {
  autobalanceMixTeams,
  generateGroupStage,
  generatePlayoffs,
  generateDoubleElimination,
  advancePlayoffWinner,
} from "@/lib/brackets";
import { calculateStandardMatchElo } from "@/lib/elo";
import { broadcastSseCommand } from "@/lib/cs2/sse";
import { normalizeCS2Map } from "@/lib/cs2/utils";
import GameAgentConnector from "@/lib/game-agent";

async function ensureTournamentsSchema(client: any) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_rules_templates (
        id SERIAL PRIMARY KEY,
        club_id INTEGER NOT NULL,
        discipline VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        rules_text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS promo_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(50) NOT NULL,
        full_name VARCHAR(255),
        nickname VARCHAR(100),
        pin_hash VARCHAR(255) NOT NULL,
        is_bot BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS promo_player_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        total_xp DECIMAL(12, 2) DEFAULT 0,
        bonus_balance DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(player_id, club_id)
      );

      CREATE TABLE IF NOT EXISTS discipline_elo (
        player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
        discipline VARCHAR(50) NOT NULL,
        elo INT DEFAULT 1000,
        matches_played INT DEFAULT 0,
        is_calibrated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (player_id, discipline)
      );

      CREATE TABLE IF NOT EXISTS promo_teams (
        id SERIAL PRIMARY KEY,
        club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        tag VARCHAR(10),
        logo_url TEXT,
        format_type VARCHAR(20) DEFAULT '5vs5',
        captain_phone VARCHAR(50) NOT NULL,
        join_code VARCHAR(50) UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS tag VARCHAR(10);
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE promo_teams ADD COLUMN IF NOT EXISTS format_type VARCHAR(20) DEFAULT '5vs5';

      CREATE TABLE IF NOT EXISTS promo_team_members (
        team_id INTEGER NOT NULL REFERENCES promo_teams(id) ON DELETE CASCADE,
        phone VARCHAR(50) NOT NULL,
        role VARCHAR(20) DEFAULT 'player',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (team_id, phone)
      );

      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        captain_id UUID,
        club_id INTEGER,
        invite_code VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS team_members (
        team_id UUID NOT NULL,
        player_id UUID NOT NULL,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (team_id, player_id)
      );

      CREATE TABLE IF NOT EXISTS tournament_competitors (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL,
        type VARCHAR(16) NOT NULL,
        display_name TEXT NOT NULL,
        team_id UUID,
        promo_team_id INTEGER,
        player_id UUID,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS team_id UUID;
      ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS promo_team_id INTEGER;
      ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS player_id UUID;
      ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS tournament_entries (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL,
        competitor_id BIGINT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
        seed INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tournament_id, competitor_id)
      );

      CREATE TABLE IF NOT EXISTS tournament_matches (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL,
        round INTEGER NOT NULL,
        order_in_round INTEGER NOT NULL,
        competitor_a_id BIGINT,
        competitor_b_id BIGINT,
        winner_competitor_id BIGINT,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        score1 INTEGER DEFAULT 0,
        score2 INTEGER DEFAULT 0,
        cs2_server_id VARCHAR(100),
        scheduled_at TIMESTAMPTZ,
        result JSONB
      );
      ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS tournament_payouts (
        id BIGSERIAL PRIMARY KEY,
        tournament_id BIGINT NOT NULL,
        competitor_id BIGINT NOT NULL,
        prize_type VARCHAR(50) DEFAULT 'combined',
        amount DECIMAL(12, 2) DEFAULT 0.00,
        item_details TEXT,
        status VARCHAR(32) DEFAULT 'COMPLETED',
        paid_at TIMESTAMPTZ DEFAULT NOW(),
        paid_by_admin_id INTEGER
      );
    `);
  } catch (migErr) {
    console.warn("Tournaments Schema Auto-Migration note:", migErr);
  }
}

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
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    // Ensure required tables and columns exist
    await ensureTournamentsSchema(client);

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

      // Fetch competitors (including team rosters and solo ELO if applicable)
      const competitorsRes = await client.query(
        `SELECT c.id, c.type, c.display_name, c.team_id, c.promo_team_id, c.player_id, c.meta, e.status as payment_status,
                COALESCE(solo_p.faceit_elo, solo_elo.elo, 1000) as player_elo,
                solo_p.faceit_lvl as player_faceit_lvl,
                solo_p.faceit_link as player_faceit_link,
                COALESCE(solo_p.avatar_url, solo_p.faceit_avatar) as player_avatar_url,
                COALESCE(solo_p.nickname, solo_p.full_name, c.display_name) as player_name,
                COALESCE(pt.logo_url, t_teams.logo_url) as team_logo,
                COALESCE(
                  (
                    SELECT json_agg(json_build_object(
                      'id', p.id,
                      'fullName', COALESCE(p.nickname, p.full_name, ptm.phone),
                      'nickname', p.nickname,
                      'phoneNumber', ptm.phone,
                      'role', ptm.role,
                      'avatarUrl', COALESCE(p.avatar_url, p.faceit_avatar),
                      'faceitLink', p.faceit_link,
                      'faceitLvl', p.faceit_lvl,
                      'faceitElo', p.faceit_elo,
                      'elo', COALESCE(p.faceit_elo, elo.elo, 1000)
                    ))
                    FROM promo_team_members ptm
                    LEFT JOIN promo_players p ON ptm.phone = p.phone_number
                    LEFT JOIN discipline_elo elo ON p.id = elo.player_id AND elo.discipline = t.discipline
                    WHERE ptm.team_id = c.promo_team_id
                  ),
                  (
                    SELECT json_agg(json_build_object(
                      'id', p.id,
                      'fullName', COALESCE(p.nickname, p.full_name),
                      'nickname', p.nickname,
                      'phoneNumber', p.phone_number,
                      'role', 'player',
                      'avatarUrl', COALESCE(p.avatar_url, p.faceit_avatar),
                      'faceitLink', p.faceit_link,
                      'faceitLvl', p.faceit_lvl,
                      'faceitElo', p.faceit_elo,
                      'elo', COALESCE(p.faceit_elo, elo.elo, 1000)
                    ))
                    FROM team_members tm
                    JOIN promo_players p ON tm.player_id::text = p.id::text
                    LEFT JOIN discipline_elo elo ON p.id = elo.player_id AND elo.discipline = t.discipline
                    WHERE tm.team_id::text = c.team_id::text
                  )
                ) as team_members
         FROM tournament_competitors c
         JOIN tournament_entries e ON c.id = e.competitor_id
         JOIN club_tournaments t ON c.tournament_id = t.id
         LEFT JOIN promo_players solo_p ON c.player_id::text = solo_p.id::text
         LEFT JOIN teams t_teams ON c.team_id::text = t_teams.id::text
         LEFT JOIN promo_teams pt ON c.promo_team_id = pt.id
         LEFT JOIN discipline_elo solo_elo ON c.player_id::text = solo_elo.player_id::text AND solo_elo.discipline = t.discipline
         WHERE c.tournament_id = $1
         ORDER BY e.created_at ASC`,
        [tournamentId]
      );

      // Fetch matches
      const matchesRes = await client.query(
        `SELECT m.id, m.round, m.order_in_round, m.competitor_a_id, m.competitor_b_id, 
                m.status, m.score1, m.score2, m.cs2_server_id, m.winner_competitor_id, m.scheduled_at, m.result
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

      // If CS2, fetch DashMatch agent status and active matches on club PCs
      let dashmatchAgent = null;
      let activeCs2Matches: any[] = [];
      if (tournament.discipline === "cs2") {
        const agentRes = await client.query(
          `SELECT club_id, lan_ip, base_port, max_instances, instances_data, last_heartbeat,
                  (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
           FROM club_cs2_agents
           WHERE club_id = $1`,
          [parsedClubId]
        ).catch(() => ({ rows: [] }));

        if (agentRes.rows && agentRes.rows.length > 0) {
          const a = agentRes.rows[0];
          dashmatchAgent = {
            is_online: Boolean(a.is_online),
            lan_ip: a.lan_ip || "127.0.0.1",
            base_port: a.base_port || 27015,
            max_instances: a.max_instances || 4,
            instances: a.instances_data || [],
            last_heartbeat: a.last_heartbeat,
          };
        }

        const cs2MatchesRes = await client.query(
          `SELECT id, map_name, match_format, team1_name, team2_name, status, port, server_ip,
                  score1, score2, rcon_last_command, rcon_last_response, game_state, match_stats, config_data
           FROM club_cs2_matches
           WHERE club_id = $1 AND status NOT IN ('stopped', 'finished')
           ORDER BY created_at DESC`,
          [parsedClubId]
        ).catch(() => ({ rows: [] }));
        activeCs2Matches = cs2MatchesRes.rows || [];
      }

      return NextResponse.json({
        tournament,
        competitors: competitorsRes.rows,
        matches: matchesRes.rows,
        payouts: payoutsRes.rows,
        dashmatchAgent,
        activeCs2Matches,
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
                  LEFT JOIN team_members tm ON c.team_id::text = tm.team_id::text 
                  LEFT JOIN promo_team_members ptm ON c.promo_team_id = ptm.team_id
                  LEFT JOIN promo_players pp ON ptm.phone = pp.phone_number
                  WHERE c.tournament_id = t.id AND (c.player_id::text = $2::text OR tm.player_id::text = $2::text OR pp.id::text = $2::text)
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
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    await ensureTournamentsSchema(client);

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
      
      // Get competitor type and team members
      const compRes = await client.query(
        `SELECT type, team_id, promo_team_id, meta FROM tournament_competitors WHERE id = $1`,
        [competitorId]
      );
      if (compRes.rows.length > 0) {
        const comp = compRes.rows[0];
        if (comp.type === "TEAM") {
          let memberIds: string[] = [];
          if (comp.promo_team_id) {
            const pMembers = await client.query(
              `SELECT p.id as player_id 
               FROM promo_team_members tm
               JOIN promo_players p ON tm.phone = p.phone_number
               WHERE tm.team_id = $1`,
              [comp.promo_team_id]
            );
            memberIds = pMembers.rows.map((r: any) => r.player_id);
          } else if (comp.team_id) {
            const membersRes = await client.query(
              `SELECT player_id FROM team_members WHERE team_id = $1`,
              [comp.team_id]
            );
            memberIds = membersRes.rows.map((r: any) => r.player_id);
          }
          const meta = comp.meta || {};
          const newMeta = { ...meta, paidPlayerIds: memberIds };
          await client.query(
            `UPDATE tournament_competitors SET meta = $1 WHERE id = $2`,
            [JSON.stringify(newMeta), competitorId]
          );
        }
      }

      await client.query(
        `UPDATE tournament_entries 
         SET status = 'PAID'
         WHERE tournament_id = $1 AND competitor_id = $2`,
        [id, competitorId]
      );
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // Action: TOGGLE PLAYER PAYMENT
    if (action === "toggle_player_payment") {
      const { competitorId, playerId, paid } = body;
      
      const compRes = await client.query(
        `SELECT tournament_id, type, team_id, promo_team_id, player_id, meta FROM tournament_competitors WHERE id = $1`,
        [competitorId]
      );
      if (compRes.rows.length === 0) {
        return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
      }
      
      const comp = compRes.rows[0];
      const tourneyId = comp.tournament_id;
      if (comp.type === "SOLO") {
        const newStatus = paid ? "PAID" : "PENDING_PAYMENT";
        await client.query(
          `UPDATE tournament_entries 
           SET status = $1 
           WHERE competitor_id = $2 AND status != 'RESERVE'`,
          [newStatus, competitorId]
        );
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tourneyId)]).catch(() => {});
        return NextResponse.json({ success: true });
      } else {
        // TEAM competitor
        let memberIds: string[] = [];
        if (comp.promo_team_id) {
          const pMembers = await client.query(
            `SELECT p.id as player_id 
             FROM promo_team_members tm
             JOIN promo_players p ON tm.phone = p.phone_number
             WHERE tm.team_id = $1`,
            [comp.promo_team_id]
          );
          memberIds = pMembers.rows.map((r: any) => r.player_id);
        } else if (comp.team_id) {
          const membersRes = await client.query(
            `SELECT player_id FROM team_members WHERE team_id = $1`,
            [comp.team_id]
          );
          memberIds = membersRes.rows.map((r: any) => r.player_id);
        }
        
        const meta = comp.meta || {};
        let paidPlayerIds = Array.isArray(meta.paidPlayerIds) ? meta.paidPlayerIds : [];
        
        if (paid) {
          if (!paidPlayerIds.includes(playerId)) {
            paidPlayerIds.push(playerId);
          }
        } else {
          paidPlayerIds = paidPlayerIds.filter((id: string) => id !== playerId);
        }
        
        const newMeta = { ...meta, paidPlayerIds };
        await client.query(
          `UPDATE tournament_competitors SET meta = $1 WHERE id = $2`,
          [JSON.stringify(newMeta), competitorId]
        );
        
        // Calculate new team entry status (if all members paid -> PAID, otherwise PENDING_PAYMENT)
        // Only if currently not in RESERVE
        const allPaid = memberIds.length > 0 && memberIds.every((id: any) => paidPlayerIds.includes(id));
        const newStatus = allPaid ? "PAID" : "PENDING_PAYMENT";
        
        await client.query(
          `UPDATE tournament_entries 
           SET status = $1 
           WHERE competitor_id = $2 AND status != 'RESERVE'`,
          [newStatus, competitorId]
        );
        
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tourneyId)]).catch(() => {});
        return NextResponse.json({ success: true });
      }
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
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
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
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // Action: GENERATE BOTS (Fill tournament with test bots)
    if (action === "generate_bots") {
      const { id, count } = body; // id = tournamentId
      await client.query("BEGIN");

      try {
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
          return NextResponse.json({ error: "Добавлять ботов можно только до старта турнира" }, { status: 400 });
        }

        const existingCountRes = await client.query(
          `SELECT COUNT(*)::int as count FROM tournament_competitors WHERE tournament_id = $1`,
          [id]
        );
        const existingCount = existingCountRes.rows[0].count;
        const maxParticipants = tournament.config?.maxParticipants || 16;
        const neededCount = count ? parseInt(count) : Math.max(2, maxParticipants - existingCount);

        const botSoloNames = [
          "[BOT] s1mple_pro", "[BOT] NeoMatrix", "[BOT] CyberKnight", "[BOT] ShadowBlade",
          "[BOT] FlashPoint", "[BOT] Vortex_CS", "[BOT] ArcticWolf", "[BOT] Phoenix_Ace",
          "[BOT] TitanSlayer", "[BOT] MirageKing", "[BOT] HyperSpeed", "[BOT] NightStalker",
          "[BOT] BlazeRider", "[BOT] GhostSniper", "[BOT] FrostByte", "[BOT] OmegaZero",
          "[BOT] ZeuS_Power", "[BOT] Valkyrie", "[BOT] Dreadnought", "[BOT] ElectroShock"
        ];

        const botTeamNames = [
          "[BOT] NAVI Junior", "[BOT] Cyber Sharks", "[BOT] Quantum 5", "[BOT] Alpha Wolves",
          "[BOT] Red Stars", "[BOT] Neon Dragons", "[BOT] Shadow Legends", "[BOT] Vortex Gaming",
          "[BOT] Titan Esports", "[BOT] Apex Force", "[BOT] Frostbite Clan", "[BOT] Phoenix Legion",
          "[BOT] Iron Wolves", "[BOT] Strike Squad", "[BOT] Nightfall Gaming", "[BOT] Omega Squad"
        ];

        const isTeamFormat = tournament.type === "2vs2" || tournament.type === "5vs5" || tournament.type === "team";
        const teamSize = tournament.type === "2vs2" || tournament.type === "mix_2vs2" ? 2 : (tournament.type === "5vs5" || tournament.type === "mix_5vs5" ? 5 : 1);
        const isMix = tournament.type === "mix" || tournament.type === "mix_2vs2" || tournament.type === "mix_5vs5";

        let addedCount = 0;

        if (isMix) {
          // For mix tournaments: generate solo bot players who will be auto-balanced
          const mixPlayersCount = neededCount > 0 ? neededCount : (teamSize * 4);
          for (let i = 0; i < mixPlayersCount; i++) {
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            const botNick = botSoloNames[(existingCount + i) % botSoloNames.length] + `_${randomSuffix}`;
            const botPhone = `+7999${Date.now().toString().slice(-5)}${i}${randomSuffix}`;
            const botElo = Math.floor(900 + Math.random() * 1100);

            let pId: string;
            const existingP = await client.query(`SELECT id FROM promo_players WHERE phone_number = $1`, [botPhone]);
            if (existingP.rows.length > 0) {
              pId = existingP.rows[0].id;
              await client.query(`UPDATE promo_players SET nickname = $1, is_bot = true WHERE id = $2`, [botNick, pId]);
            } else {
              const pRes = await client.query(
                `INSERT INTO promo_players (phone_number, full_name, nickname, pin_hash, is_bot)
                 VALUES ($1, $2, $3, 'BOT_PIN_HASH', true)
                 RETURNING id`,
                [botPhone, botNick, botNick]
              );
              pId = pRes.rows[0].id;
            }

            await client.query(
              `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
               VALUES ($1, $2, 0, 0)
               ON CONFLICT (player_id, club_id) DO NOTHING`,
              [pId, parsedClubId]
            );

            await client.query(
              `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
               VALUES ($1, $2, $3, 0, false)
               ON CONFLICT (player_id, discipline) DO UPDATE SET elo = $3`,
              [pId, tournament.discipline, botElo]
            );

            const compRes = await client.query(
              `INSERT INTO tournament_competitors (tournament_id, type, display_name, player_id, meta)
               VALUES ($1, 'SOLO', $2, $3, $4)
               RETURNING id`,
              [id, botNick, pId, JSON.stringify({ isBot: true, elo: botElo })]
            );
            const compId = compRes.rows[0].id;

            await client.query(
              `INSERT INTO tournament_entries (tournament_id, competitor_id, status)
               VALUES ($1, $2, 'PAID')`,
              [id, compId]
            );
            addedCount++;
          }
        } else if (isTeamFormat) {
          // For team tournaments: generate bot teams with rosters
          for (let i = 0; i < neededCount; i++) {
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            const teamName = botTeamNames[(existingCount + i) % botTeamNames.length] + (existingCount > 0 ? ` #${existingCount + i + 1}` : "");
            const captainPhone = `+7999${Date.now().toString().slice(-5)}${i}0${randomSuffix}`;
            const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase() + String(randomSuffix).slice(0, 2);

            const promoTeamRes = await client.query(
              `INSERT INTO promo_teams (club_id, name, tag, format_type, captain_phone, join_code)
               VALUES ($1, $2, 'BOT', $3, $4, $5)
               RETURNING id`,
              [parsedClubId, teamName, tournament.type === "2vs2" ? "2vs2" : "5vs5", captainPhone, joinCode]
            );
            const teamId = promoTeamRes.rows[0].id;

            // Generate members
            for (let m = 0; m < teamSize; m++) {
              const memberSuffix = Math.floor(100 + Math.random() * 900);
              const memberNick = `${teamName.replace('[BOT] ', '')}_${m === 0 ? 'Cap' : 'P' + m}`;
              const memberPhone = m === 0 ? captainPhone : `+7999${Date.now().toString().slice(-5)}${i}${m}${memberSuffix}`;
              const memberElo = Math.floor(950 + Math.random() * 1000);

              let mPlayerId: string;
              const existingMP = await client.query(`SELECT id FROM promo_players WHERE phone_number = $1`, [memberPhone]);
              if (existingMP.rows.length > 0) {
                mPlayerId = existingMP.rows[0].id;
                await client.query(`UPDATE promo_players SET nickname = $1, is_bot = true WHERE id = $2`, [memberNick, mPlayerId]);
              } else {
                const pRes = await client.query(
                  `INSERT INTO promo_players (phone_number, full_name, nickname, pin_hash, is_bot)
                   VALUES ($1, $2, $3, 'BOT_PIN_HASH', true)
                   RETURNING id`,
                  [memberPhone, memberNick, memberNick]
                );
                mPlayerId = pRes.rows[0].id;
              }

              await client.query(
                `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
                 VALUES ($1, $2, 0, 0)
                 ON CONFLICT (player_id, club_id) DO NOTHING`,
                [mPlayerId, parsedClubId]
              );

              await client.query(
                `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
                 VALUES ($1, $2, $3, 0, false)
                 ON CONFLICT (player_id, discipline) DO UPDATE SET elo = $3`,
                [mPlayerId, tournament.discipline, memberElo]
              );

              await client.query(
                `INSERT INTO promo_team_members (team_id, phone, role)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (team_id, phone) DO UPDATE SET role = $3`,
                [teamId, memberPhone, m === 0 ? 'captain' : 'player']
              );
            }

            const compRes = await client.query(
              `INSERT INTO tournament_competitors (tournament_id, type, display_name, promo_team_id, meta)
               VALUES ($1, 'TEAM', $2, $3, $4)
               RETURNING id`,
              [id, teamName, teamId, JSON.stringify({ isBot: true })]
            );
            const compId = compRes.rows[0].id;

            await client.query(
              `INSERT INTO tournament_entries (tournament_id, competitor_id, status)
               VALUES ($1, $2, 'PAID')`,
              [id, compId]
            );
            addedCount++;
          }
        } else {
          // Solo tournament (1vs1 / fifa / ufc)
          for (let i = 0; i < neededCount; i++) {
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            const botNick = botSoloNames[(existingCount + i) % botSoloNames.length] + (existingCount > 0 ? ` #${existingCount + i + 1}` : "");
            const botPhone = `+7999${Date.now().toString().slice(-5)}${i}${randomSuffix}`;
            const botElo = Math.floor(950 + Math.random() * 1000);

            let pId: string;
            const existingP = await client.query(`SELECT id FROM promo_players WHERE phone_number = $1`, [botPhone]);
            if (existingP.rows.length > 0) {
              pId = existingP.rows[0].id;
              await client.query(`UPDATE promo_players SET nickname = $1, is_bot = true WHERE id = $2`, [botNick, pId]);
            } else {
              const pRes = await client.query(
                `INSERT INTO promo_players (phone_number, full_name, nickname, pin_hash, is_bot)
                 VALUES ($1, $2, $3, 'BOT_PIN_HASH', true)
                 RETURNING id`,
                [botPhone, botNick, botNick]
              );
              pId = pRes.rows[0].id;
            }

            await client.query(
              `INSERT INTO promo_player_balances (player_id, club_id, total_xp, bonus_balance)
               VALUES ($1, $2, 0, 0)
               ON CONFLICT (player_id, club_id) DO NOTHING`,
              [pId, parsedClubId]
            );

            await client.query(
              `INSERT INTO discipline_elo (player_id, discipline, elo, matches_played, is_calibrated)
               VALUES ($1, $2, $3, 0, false)
               ON CONFLICT (player_id, discipline) DO UPDATE SET elo = $3`,
              [pId, tournament.discipline, botElo]
            );

            const compRes = await client.query(
              `INSERT INTO tournament_competitors (tournament_id, type, display_name, player_id, meta)
               VALUES ($1, 'SOLO', $2, $3, $4)
               RETURNING id`,
              [id, botNick, pId, JSON.stringify({ isBot: true, elo: botElo })]
            );
            const compId = compRes.rows[0].id;

            await client.query(
              `INSERT INTO tournament_entries (tournament_id, competitor_id, status)
               VALUES ($1, $2, 'PAID')`,
              [id, compId]
            );
            addedCount++;
          }
        }

        await client.query("COMMIT");
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
        return NextResponse.json({ success: true, addedCount });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Generate Bots Error:", err);
        return NextResponse.json({ error: err.message || "Ошибка при генерации ботов" }, { status: 500 });
      }
    }

    // Action: CLEAR BOTS
    if (action === "clear_bots") {
      const { id } = body; // id = tournamentId
      await client.query("BEGIN");

      try {
        await client.query(`DELETE FROM tournament_matches WHERE tournament_id = $1`, [id]);

        const botCompsRes = await client.query(
          `SELECT id, promo_team_id, player_id FROM tournament_competitors 
           WHERE tournament_id = $1 AND (meta->>'isBot' = 'true' OR display_name LIKE '%(BOT)%' OR display_name LIKE '[BOT]%' OR display_name LIKE 'Mix Team %')`,
          [id]
        );

        for (const comp of botCompsRes.rows) {
          await client.query(`DELETE FROM tournament_entries WHERE competitor_id = $1`, [comp.id]);
          await client.query(`DELETE FROM tournament_competitors WHERE id = $1`, [comp.id]);
          if (comp.promo_team_id) {
            await client.query(`DELETE FROM promo_team_members WHERE team_id = $1`, [comp.promo_team_id]);
            await client.query(`DELETE FROM promo_teams WHERE id = $1`, [comp.promo_team_id]);
          }
        }

        // Reset tournament status to REGISTRATION if it was ACTIVE
        await client.query(
          `UPDATE club_tournaments SET status = 'REGISTRATION' WHERE id = $1 AND status = 'ACTIVE'`,
          [id]
        );

        await client.query("COMMIT");
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
        return NextResponse.json({ success: true, clearedCount: botCompsRes.rows.length });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Clear Bots Error:", err);
        return NextResponse.json({ error: err.message || "Ошибка при очистке ботов" }, { status: 500 });
      }
    }

    // Action: SIMULATE MATCHES (Auto-play current round matches for testing)
    if (action === "simulate_matches") {
      const { id } = body; // id = tournamentId
      await client.query("BEGIN");

      const activeMatchesRes = await client.query(
        `SELECT m.id, m.round, m.order_in_round, m.competitor_a_id, m.competitor_b_id, m.status, t.discipline
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.tournament_id = $1 AND m.competitor_a_id IS NOT NULL AND m.competitor_b_id IS NOT NULL AND m.status != 'FINISHED'
         ORDER BY m.round ASC, m.order_in_round ASC`,
        [id]
      );

      if (activeMatchesRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Нет активных матчей для симуляции" }, { status: 400 });
      }

      let simulatedCount = 0;
      for (const match of activeMatchesRes.rows) {
        let score1 = 0;
        let score2 = 0;
        const disc = (match.discipline || "").toLowerCase();

        if (disc === "fifa") {
          score1 = Math.floor(Math.random() * 4);
          score2 = Math.floor(Math.random() * 4);
          if (score1 === score2) score1 += 1;
        } else if (disc === "ufc") {
          score1 = Math.random() > 0.5 ? 3 : 0;
          score2 = score1 === 3 ? Math.floor(Math.random() * 3) : 3;
        } else {
          // CS2
          const winScore = 13;
          const loseScore = Math.floor(5 + Math.random() * 7); // 5 to 11
          if (Math.random() > 0.5) {
            score1 = winScore;
            score2 = loseScore;
          } else {
            score1 = loseScore;
            score2 = winScore;
          }
        }

        const winnerId = score1 > score2 ? match.competitor_a_id : match.competitor_b_id;

        await client.query(
          `UPDATE tournament_matches
           SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3
           WHERE id = $4`,
          [score1, score2, winnerId, match.id]
        );

        // Progress playoff bracket if round >= 1
        if (match.round >= 1) {
          await advancePlayoffWinner(client, match.id, winnerId);
        }

        simulatedCount++;
      }

      await client.query("COMMIT");
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
      return NextResponse.json({ success: true, simulatedCount });
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

        const players = playersRes.rows.map((r: any) => ({
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

        // Clean up individual solo competitor registrations for this mix tournament
        await client.query(
          `DELETE FROM tournament_entries WHERE tournament_id = $1`,
          [id]
        );
        await client.query(
          `DELETE FROM tournament_competitors WHERE tournament_id = $1`,
          [id]
        );

        // Run ELO Autobalance and register mixed teams
        paidCompetitors = await autobalanceMixTeams(client, parsedClubId, id, players, teamSize);
      } else {
        if (body.includeAllUnpaid) {
          await client.query(
            `UPDATE tournament_entries
             SET status = 'PAID'
             WHERE tournament_id = $1 AND status = 'PENDING_PAYMENT'`,
            [id]
          );
        }

        // Standard solo/team registration
        const compsRes = await client.query(
          `SELECT competitor_id 
           FROM tournament_entries 
           WHERE tournament_id = $1 AND status = 'PAID'`,
          [id]
        );
        paidCompetitors = compsRes.rows.map((r: any) => r.competitor_id);
      }

      if (paidCompetitors.length < 2) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Для старта турнира требуется минимум 2 оплативших участника" }, { status: 400 });
      }

      // Generate matches based on tournament configuration (bracketType)
      const bracketType = tournament.config?.bracketType;
      const tournamentStartTime = tournament.starts_at || new Date();

      if (bracketType === "double_elimination") {
        await generateDoubleElimination(client, id, paidCompetitors, tournamentStartTime);
      } else if (bracketType === "round_robin") {
        await generateGroupStage(client, id, paidCompetitors, tournamentStartTime);
      } else {
        // Default: Single Elimination (Playoff)
        await generatePlayoffs(client, id, paidCompetitors, tournamentStartTime);
      }

      // Update status to active
      await client.query(
        `UPDATE club_tournaments SET status = 'ACTIVE' WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
      return NextResponse.json({ success: true });
    }

    // Action: REBUILD BRACKET (Reset matches and regenerate bracket)
    if (action === "rebuild_bracket") {
      const { id, bracketType, includeAllUnpaid } = body;
      await client.query("BEGIN");

      try {
        const tournamentRes = await client.query(
          `SELECT * FROM club_tournaments WHERE id = $1 AND club_id = $2`,
          [id, parsedClubId]
        );
        if (tournamentRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Турнир не найден" }, { status: 404 });
        }

        const tournament = tournamentRes.rows[0];

        // 1. Delete all existing matches
        await client.query(`DELETE FROM tournament_matches WHERE tournament_id = $1`, [id]);

        // 2. If includeAllUnpaid is requested, set PENDING_PAYMENT to PAID
        if (includeAllUnpaid) {
          await client.query(
            `UPDATE tournament_entries
             SET status = 'PAID'
             WHERE tournament_id = $1 AND status = 'PENDING_PAYMENT'`,
            [id]
          );
        }

        // 3. Fetch all paid competitors
        const compsRes = await client.query(
          `SELECT competitor_id 
           FROM tournament_entries 
           WHERE tournament_id = $1 AND status = 'PAID'`,
          [id]
        );
        const paidCompetitors = compsRes.rows.map((r: any) => r.competitor_id);

        if (paidCompetitors.length < 2) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Для генерации сетки требуется минимум 2 оплативших участника" },
            { status: 400 }
          );
        }

        // 4. Update bracketType in tournament.config if specified
        const selectedBracketType = bracketType || tournament.config?.bracketType || "single_elimination";
        const newConfig = {
          ...(tournament.config || {}),
          bracketType: selectedBracketType,
        };

        await client.query(
          `UPDATE club_tournaments 
           SET config = $1, status = 'ACTIVE' 
           WHERE id = $2`,
          [JSON.stringify(newConfig), id]
        );

        // 5. Generate fresh bracket
        const tournamentStartTime = tournament.starts_at || new Date();

        if (selectedBracketType === "double_elimination") {
          await generateDoubleElimination(client, id, paidCompetitors, tournamentStartTime);
        } else if (selectedBracketType === "round_robin") {
          await generateGroupStage(client, id, paidCompetitors, tournamentStartTime);
        } else {
          await generatePlayoffs(client, id, paidCompetitors, tournamentStartTime);
        }

        await client.query("COMMIT");
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(id)]).catch(() => {});
        return NextResponse.json({ success: true, bracketType: selectedBracketType, competitorsCount: paidCompetitors.length });
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Rebuild Bracket Error:", err);
        return NextResponse.json({ error: err.message || "Ошибка при пересборке сетки" }, { status: 500 });
      }
    }

    // Action: UPDATE MATCH SCHEDULE
    if (action === "update_match_schedule") {
      const { matchId, scheduledAt } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      await client.query(
        `UPDATE tournament_matches
         SET scheduled_at = $1
         WHERE id = $2`,
        [scheduledAt ? new Date(scheduledAt) : null, matchId]
      );

      const mRes = await client.query(`SELECT tournament_id FROM tournament_matches WHERE id = $1`, [matchId]).catch(() => ({ rows: [] }));
      if (mRes.rows.length > 0) {
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(mRes.rows[0].tournament_id)]).catch(() => {});
      }
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});

      return NextResponse.json({ success: true });
    }

    // Action: TECHNICAL WIN (Defwin / Forfeit)
    if (action === "tech_win") {
      const { matchId, winnerCompetitorId, reason } = body;
      if (!matchId || !winnerCompetitorId) {
        return NextResponse.json({ error: "ID матча и победитель обязательны" }, { status: 400 });
      }

      await client.query("BEGIN");

      const matchRes = await client.query(
        `SELECT id, tournament_id, round, competitor_a_id, competitor_b_id, status, result
         FROM tournament_matches
         WHERE id = $1`,
        [matchId]
      );

      if (matchRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
      }

      const match = matchRes.rows[0];
      const isWinnerA = String(winnerCompetitorId) === String(match.competitor_a_id);
      const score1 = isWinnerA ? 1 : 0;
      const score2 = isWinnerA ? 0 : 1;
      const newResult = {
        ...(match.result || {}),
        isTechWin: true,
        techWinReason: reason || "Техническое поражение соперника",
      };

      await client.query(
        `UPDATE tournament_matches
         SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3, result = $4
         WHERE id = $5`,
        [score1, score2, winnerCompetitorId, JSON.stringify(newResult), matchId]
      );

      if (match.round > 0) {
        await advancePlayoffWinner(client, matchId, winnerCompetitorId);
      }

      await client.query("COMMIT");
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
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
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
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

    // Action: LAUNCH MATCH SERVER ON DEDICATED PC (DashMatch)
    if (action === "launch_match_server") {
      const { matchId, selectedMap, knifeRound = true, practiceMode = false } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      // 1. Fetch match & tournament details
      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.competitor_a_id, m.competitor_b_id,
                t.name as tournament_name, t.config as tournament_config, t.discipline
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1 AND t.club_id = $2`,
        [matchId, parsedClubId]
      );

      if (matchRes.rowCount === 0) {
        return NextResponse.json({ error: "Матч турнира не найден" }, { status: 404 });
      }

      const match = matchRes.rows[0];
      const compARes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_a_id]);
      const compBRes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_b_id]);
      const nameA = compARes.rows[0]?.display_name || "Команда 1";
      const nameB = compBRes.rows[0]?.display_name || "Команда 2";

      // 2. Fetch agent status to get LAN IP and port
      const agentRes = await client.query(
        `SELECT lan_ip, base_port, max_instances, (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
         FROM club_cs2_agents
         WHERE club_id = $1`,
        [parsedClubId]
      );
      const agent = agentRes.rows[0];
      const serverIp = agent?.lan_ip || "127.0.0.1";
      const basePort = agent?.base_port || 27015;
      const maxInstances = agent?.max_instances || 4;

      // 3. Find lowest free port
      const usedPortsRes = await client.query(
        `SELECT port FROM club_cs2_matches WHERE club_id = $1 AND status NOT IN ('stopped', 'finished')`,
        [parsedClubId]
      );
      const usedPorts = new Set(usedPortsRes.rows.map((r: any) => r.port));
      let assignedPort = basePort;
      for (let i = 0; i < maxInstances; i++) {
        if (!usedPorts.has(basePort + i)) {
          assignedPort = basePort + i;
          break;
        }
      }

      const tConfig = match.tournament_config || {};
      const rawChosenMap = (selectedMap || tConfig.mapPool?.[0] || "de_mirage").trim();
      const chosenMap = normalizeCS2Map(rawChosenMap);
      const matchFormat = tConfig.matchFormat || "5v5";
      const dmMatchId = `dm-tourney-${matchId}`;
      const matchzyId = parseInt(String(matchId), 10) || (Math.floor(Date.now() / 1000) % 2000000000 + 1);

      // 4. Ensure tables exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS club_cs2_matches (
          id VARCHAR(64) PRIMARY KEY,
          club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
          map_name VARCHAR(64) NOT NULL,
          match_format VARCHAR(16) DEFAULT '5v5',
          team1_name VARCHAR(64) DEFAULT 'Команда 1',
          team2_name VARCHAR(64) DEFAULT 'Команда 2',
          status VARCHAR(32) DEFAULT 'starting',
          port INT DEFAULT 27015,
          server_ip VARCHAR(64),
          score1 INT DEFAULT 0,
          score2 INT DEFAULT 0,
          config_data JSONB DEFAULT '{}'::jsonb,
          matchzy_id BIGINT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS club_cs2_commands (
          id SERIAL PRIMARY KEY,
          club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
          command_type VARCHAR(32) NOT NULL,
          match_id VARCHAR(64),
          payload JSONB DEFAULT '{}'::jsonb,
          status VARCHAR(32) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // 5. Upsert match in club_cs2_matches
      await client.query(
        `INSERT INTO club_cs2_matches (id, club_id, map_name, match_format, team1_name, team2_name, status, port, server_ip, matchzy_id, config_data)
         VALUES ($1, $2, $3, $4, $5, $6, 'starting', $7, $8, $9, $10::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           map_name = $3,
           status = 'starting',
           port = $7,
           server_ip = $8,
           matchzy_id = $9,
           config_data = $10::jsonb,
           updated_at = NOW()`,
        [
          dmMatchId,
          parsedClubId,
          chosenMap,
          matchFormat,
          nameA,
          nameB,
          assignedPort,
          serverIp,
          matchzyId,
          JSON.stringify({
            knife_round: Boolean(knifeRound),
            practice_mode: Boolean(practiceMode),
            tournament_match_id: matchId,
            warmup_time: 60,
          }),
        ]
      );

      // 6. Update tournament match record
      await client.query(
        `UPDATE tournament_matches
         SET cs2_server_id = $1, status = CASE WHEN status = 'PENDING' THEN 'IN_PROGRESS' ELSE status END
         WHERE id = $2`,
        [dmMatchId, matchId]
      );

      // 7. Enqueue START_MATCH command and send via SSE
      const configUrl = `https://mydashadmin.ru/api/clubs/${parsedClubId}/cs2/matches/${matchId}/config`;
      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'START_MATCH', $2, $3, 'pending')`,
        [
          parsedClubId,
          dmMatchId,
          JSON.stringify({
            map_name: chosenMap,
            match_format: matchFormat,
            config_url: configUrl,
            auth_token: `secret_${matchId}`,
          }),
        ]
      );

      broadcastSseCommand(parsedClubId, {
        type: "START_MATCH",
        match_id: dmMatchId,
        map_name: chosenMap,
        match_format: matchFormat,
        config_url: configUrl,
        auth_token: `secret_${matchId}`,
      });

      // Notify match lobby & bracket
      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});

      return NextResponse.json({
        success: true,
        match_id: dmMatchId,
        server_ip: serverIp,
        port: assignedPort,
        connect_command: `connect ${serverIp}:${assignedPort}`,
        message: "Команда запуска сервера отправлена на выделенный ПК клуба!",
      });
    }

    // Action: RESTART MATCH SERVER (DashMatch)
    if (action === "restart_match_server") {
      const { matchId } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      const matchRes = await client.query(
        `SELECT m.id, m.tournament_id, m.competitor_a_id, m.competitor_b_id, m.cs2_server_id,
                t.name as tournament_name, t.config as tournament_config
         FROM tournament_matches m
         JOIN club_tournaments t ON m.tournament_id = t.id
         WHERE m.id = $1 AND t.club_id = $2`,
        [matchId, parsedClubId]
      );
      if (matchRes.rowCount === 0) {
        return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
      }
      const match = matchRes.rows[0];

      const compARes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_a_id]);
      const compBRes = await client.query(`SELECT display_name FROM tournament_competitors WHERE id = $1`, [match.competitor_b_id]);
      const nameA = compARes.rows[0]?.display_name || "Команда А";
      const nameB = compBRes.rows[0]?.display_name || "Команда Б";

      const dmMatchId = `dm-tourney-${matchId}`;

      // 1. Send STOP_MATCH first to clean up existing process
      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
        [parsedClubId, dmMatchId]
      ).catch(() => {});
      broadcastSseCommand(parsedClubId, { type: "STOP_MATCH", match_id: dmMatchId });

      // 2. Fetch agent info & available port
      const agentRes = await client.query(
        `SELECT lan_ip, base_port, max_instances, (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
         FROM club_cs2_agents
         WHERE club_id = $1`,
        [parsedClubId]
      );
      const agent = agentRes.rows[0];
      const serverIp = agent?.lan_ip || process.env.GAME_SERVER_IP || "127.0.0.1";
      const basePort = agent?.base_port || 27015;
      const maxInstances = agent?.max_instances || 4;

      const usedPortsRes = await client.query(
        `SELECT port FROM club_cs2_matches WHERE club_id = $1 AND id != $2 AND status NOT IN ('stopped', 'finished')`,
        [parsedClubId, dmMatchId]
      );
      const usedPorts = new Set(usedPortsRes.rows.map((r: any) => r.port));
      let assignedPort = basePort;
      for (let i = 0; i < maxInstances; i++) {
        if (!usedPorts.has(basePort + i)) {
          assignedPort = basePort + i;
          break;
        }
      }

      // 3. Determine selected map
      const vetoRes = await client.query(`SELECT selected_map FROM match_veto WHERE match_id = $1`, [matchId]).catch(() => ({ rows: [] }));
      const vetoMap = vetoRes.rows[0]?.selected_map;
      const tConfig = match.tournament_config || {};
      const rawChosenMap = (body.selectedMap || vetoMap || tConfig.mapPool?.[0] || "de_mirage").trim();
      const chosenMap = normalizeCS2Map(rawChosenMap);
      const matchFormat = tConfig.matchFormat || "5v5";
      const matchzyId = parseInt(String(matchId), 10) || (Math.floor(Date.now() / 1000) % 2000000000 + 1);

      // 4. Update club_cs2_matches
      await client.query(
        `INSERT INTO club_cs2_matches (id, club_id, map_name, match_format, team1_name, team2_name, status, port, server_ip, matchzy_id, config_data, rcon_last_command, rcon_last_response, score1, score2, game_state)
         VALUES ($1, $2, $3, $4, $5, $6, 'starting', $7, $8, $9, $10::jsonb, NULL, NULL, 0, 0, 'warmup')
         ON CONFLICT (id) DO UPDATE SET
           map_name = $3,
           status = 'starting',
           port = $7,
           server_ip = $8,
           matchzy_id = $9,
           config_data = $10::jsonb,
           rcon_last_command = NULL,
           rcon_last_response = NULL,
           score1 = 0,
           score2 = 0,
           game_state = 'warmup',
           updated_at = NOW()`,
        [
          dmMatchId,
          parsedClubId,
          chosenMap,
          matchFormat,
          nameA,
          nameB,
          assignedPort,
          serverIp,
          matchzyId,
          JSON.stringify({
            knife_round: body.knifeRound !== undefined ? Boolean(body.knifeRound) : true,
            practice_mode: body.practiceMode !== undefined ? Boolean(body.practiceMode) : false,
            tournament_match_id: matchId,
            warmup_time: 60,
          }),
        ]
      );

      // 5. Update tournament match record
      await client.query(
        `UPDATE tournament_matches
         SET cs2_server_id = $1, status = 'STARTING'
         WHERE id = $2`,
        [dmMatchId, matchId]
      );

      // 6. Enqueue START_MATCH command
      const configUrl = `https://mydashadmin.ru/api/clubs/${parsedClubId}/cs2/matches/${matchId}/config`;
      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'START_MATCH', $2, $3, 'pending')`,
        [
          parsedClubId,
          dmMatchId,
          JSON.stringify({
            map_name: chosenMap,
            match_format: matchFormat,
            config_url: configUrl,
            auth_token: `secret_${matchId}`,
          }),
        ]
      );

      broadcastSseCommand(parsedClubId, {
        type: "START_MATCH",
        match_id: dmMatchId,
        map_name: chosenMap,
        match_format: matchFormat,
        config_url: configUrl,
        auth_token: `secret_${matchId}`,
      });

      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
      await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});

      return NextResponse.json({
        success: true,
        match_id: dmMatchId,
        server_ip: serverIp,
        port: assignedPort,
        connect_command: `connect ${serverIp}:${assignedPort}`,
        message: "Сервер CS2 перезапускается на ПК клуба!",
      });
    }

    // Action: RESET MATCH LOBBY (Reset Lobby & Veto)
    if (action === "reset_match_lobby") {
      const { matchId, resetCheckin } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      const dmMatchId = `dm-tourney-${matchId}`;

      // 1. Stop CS2 server
      await client.query(
        `UPDATE club_cs2_matches SET status = 'stopped', updated_at = NOW() WHERE (id = $1 OR id = $2) AND club_id = $3`,
        [dmMatchId, matchId, parsedClubId]
      ).catch(() => {});

      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
        [parsedClubId, dmMatchId]
      ).catch(() => {});
      broadcastSseCommand(parsedClubId, { type: "STOP_MATCH", match_id: dmMatchId });

      // 2. Delete veto state
      await client.query(`DELETE FROM match_veto WHERE match_id = $1`, [matchId]).catch(() => {});

      // 3. Reset checkins if requested
      if (resetCheckin) {
        await client.query(`DELETE FROM lobby_checkin WHERE match_id::text = $1 OR match_id::text = $2`, [String(matchId), dmMatchId]).catch(() => {});
      }

      // 4. Reset tournament match status
      await client.query(
        `UPDATE tournament_matches
         SET cs2_server_id = NULL, status = 'PENDING', score1 = 0, score2 = 0, winner_competitor_id = NULL
         WHERE id = $1`,
        [matchId]
      );

      const tRes = await client.query(`SELECT tournament_id FROM tournament_matches WHERE id = $1`, [matchId]).catch(() => ({ rows: [] }));
      const tournamentId = tRes.rows[0]?.tournament_id;

      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});
      if (tournamentId) {
        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(tournamentId)]).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        message: "Лобби матча и стадия вето успешно сброшены!",
      });
    }

    // Action: STOP MATCH SERVER (DashMatch)
    if (action === "stop_match_server") {
      const { matchId } = body;
      if (!matchId) {
        return NextResponse.json({ error: "ID матча обязателен" }, { status: 400 });
      }

      const dmMatchId = String(matchId).startsWith("dm-") ? String(matchId) : `dm-tourney-${matchId}`;

      // Update club_cs2_matches
      await client.query(
        `UPDATE club_cs2_matches SET status = 'stopped', updated_at = NOW() WHERE (id = $1 OR id = $2) AND club_id = $3`,
        [dmMatchId, `dm-tourney-${matchId}`, parsedClubId]
      ).catch(() => {});

      // Enqueue command & SSE
      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
        [parsedClubId, dmMatchId]
      ).catch(() => {});

      broadcastSseCommand(parsedClubId, {
        type: "STOP_MATCH",
        match_id: dmMatchId,
      });

      await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Команда остановки сервера отправлена на ПК клуба",
      });
    }

    // Action: SEND RCON COMMAND (DashMatch)
    if (action === "send_rcon_command") {
      const { matchId, command } = body;
      if (!matchId || !command) {
        return NextResponse.json({ error: "matchId и command обязательны" }, { status: 400 });
      }

      const dmMatchId = String(matchId).startsWith("dm-") ? String(matchId) : `dm-tourney-${matchId}`;

      await client.query(
        `UPDATE club_cs2_matches
         SET rcon_last_command = $1, rcon_last_response = 'Ожидание ответа сервера...', updated_at = NOW()
         WHERE (id = $2 OR id = $3) AND club_id = $4`,
        [command, dmMatchId, `dm-tourney-${matchId}`, parsedClubId]
      ).catch(() => {});

      await client.query(
        `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
         VALUES ($1, 'RCON_COMMAND', $2, $3, 'pending')`,
        [parsedClubId, dmMatchId, JSON.stringify({ command })]
      ).catch(() => {});

      broadcastSseCommand(parsedClubId, {
        type: "RCON_COMMAND",
        match_id: dmMatchId,
        command: command,
      });

      return NextResponse.json({
        success: true,
        message: `RCON команда "${command}" отправлена на сервер`,
      });
    }

    // Action: SYNC MATCH STATS (CS2 automatic stats fetching fallback)
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

      const dmMatchId = match.cs2_server_id || `dm-tourney-${matchId}`;
      const cs2Res = await client.query(
        `SELECT * FROM club_cs2_matches WHERE (id = $1 OR id = $2) AND club_id = $3`,
        [dmMatchId, `dm-tourney-${matchId}`, parsedClubId]
      );

      if (cs2Res.rowCount && cs2Res.rowCount > 0) {
        const cs2m = cs2Res.rows[0];
        const team1Score = cs2m.score1 || 0;
        const team2Score = cs2m.score2 || 0;
        const team1Won = team1Score > team2Score;
        const winnerCompetitorId = team1Won ? match.competitor_a_id : match.competitor_b_id;

        await client.query("BEGIN");
        await client.query(
          `UPDATE tournament_matches
           SET score1 = $1, score2 = $2, status = 'FINISHED', winner_competitor_id = $3, result = $4
           WHERE id = $5`,
          [team1Score, team2Score, winnerCompetitorId, JSON.stringify(cs2m.match_stats || {}), matchId]
        );

        if (match.round > 0 && winnerCompetitorId) {
          await advancePlayoffWinner(client, matchId, winnerCompetitorId);
        }

        await client.query("COMMIT");

        await client.query(`SELECT pg_notify('tournament_updates', $1)`, [String(match.tournament_id)]).catch(() => {});
        await client.query(`SELECT pg_notify('match_lobby_updates', $1)`, [String(matchId)]).catch(() => {});

        return NextResponse.json({ success: true, score1: team1Score, score2: team2Score });
      }

      return NextResponse.json({ error: "Данные матча в DashMatch пока не найдены" }, { status: 404 });
    }

    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch (error) {
    console.error("Admin Tournaments POST Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
